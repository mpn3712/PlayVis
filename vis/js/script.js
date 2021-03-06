var width = Math.floor(parseFloat(window.getComputedStyle(document.querySelector('#chart')).width.replace('px', ''))),
    height = Math.floor(parseFloat(window.getComputedStyle(document.querySelector('#chart')).height.replace('px', ''))),
    nodes = [],
    links = [],
    linkNames = [],
    paused = false,
    menu = false,
    neighbors = false,
    curr_node = null,
    speed = 80;


var force = d3.layout.force()
    .size([width, height])
    .nodes(nodes)
    .links([])
    .linkStrength(1)
    .linkDistance(80)
    .charge(function (d) {
        return -300;
    })
    .on("tick", tick);

var svg = d3.select("#chart").append("svg")
    .attr("width", width)
    .attr("height", height)

svg.append("rect")
    .attr("width", width)
    .attr("height", height);

var node_names = {},
    link_names = {},
    node = svg.selectAll(".node"),
    link = svg.selectAll(".link");

var texts = svg.selectAll("text.label");

var min_sent = 0,
    max_sent = 0,
    max_interactions = 1;

var colors = d3.scale.category10();

update();

/**
 * Event listener for the pause button. Will pause the play animation
 * @param  {event} event 
 * @return {none}       none
 */
document.getElementById('stop').addEventListener('click', function (event) {
    if (neighbors) return;

    //TODO: Make sure transition is correct.
    if (!paused) {
        window.clearInterval(window.id);
        d3.select('#stop')
          .html('Resume')
          .attr('class', 'btn btn-success');
        
        d3.select('#chart')
          .transition(2000)
          .style('background-color', 'rgb(237, 255, 248)');
    } else {
        window.id = window.setInterval(interval, speed);
        d3.select('#stop')
          .html('Pause')
          .attr('class', 'btn btn-danger');

        d3.select('#chart')
          .transition(2000)
          .style('background-color', 'rgb(255, 255, 255)');
    }

    paused = !paused;
});

/**
 * Event listener for showing the neighbors. Will show only neighbors of the 
 * currently selected node
 * @param  {event} event 
 * @return {none}       none
 */
document.getElementById('neighbors').addEventListener('click', function (event) {
    if (!neighbors) {
        showNeighbors(curr_node)
        d3.select('#neighbors').html('Show All Nodes');
        force.gravity(0.3);
        update();
        pause();
    } else {
        unshowNeighbors()
        force.gravity(0.1);
        update(0);
        d3.select('#neighbors').html('Show Only Neighbors');
    }

    neighbors = !neighbors;
});

/**
 * Click event handler for slider tray on mobile
 * @param  {event} event 
 * @return {none}       none
 */
document.getElementById('up').addEventListener('click', function (event) {
    if (!menu) {
        var side = window.getComputedStyle(document.getElementsByClassName('side')[0]).height.replace('px', '');
        if(side < 450) {
            d3.select('.side')
              .transition()
              .style('margin-top', '-'+side+'px');
        } else {
            d3.select('.side')
              .transition()
              .style('margin-top', '-450px');
        }
        d3.select('#toggle')
          .attr('class', 'glyphicon glyphicon-chevron-down')
          .style('margin-left', '4px');
    } else {
        d3.select('.side')
          .transition()
          .style('margin-top', '0px');
        d3.select('#toggle')
          .attr('class', 'glyphicon glyphicon-chevron-up')
          .style('margin-left', '7px');
    }

    menu = !menu;
});

/**
 * Loads the json file of events
 * @param  {error} error if error exists it will give some info on what happened
 * @param  {object} json  the loaded json
 * @return {none}       none
 */
d3.json('output.json', function (error, json) { // ajax for the json and start the animation
    window.timeline = d3.scale.linear()
            .range([0, 100])
            .domain([0, json.length]);
    window.i = 0;
    window.json = json;
    window.id = window.setInterval(interval, speed);
});

/**
 * This is our main animtion loop. Fires once for every "event" in our json
 * @return {none} none
 */
function interval () {
    update();
    if (i >= json.length) {
        return;
    }

    d3.select('#line').html('Line #: ' + i);
    
    var time_width = timeline(i);
    d3.select('#time')
        .attr('style', 'width: ' + time_width + '%');

    var d = json[i];

    if (d.current_char in node_names == false) { // if new character
        var node = { name: d.current_char, radius: 5, sentiment: d.sentiment, last_line: i, lines: 0 };
        
        nodes.push(node);
        node_names[d.current_char] = node;
    } else {
        node_names[d.current_char].radius += 0.1; // increment character size
        node_names[d.current_char].lines++;
    }

    var current_char = node_names[d.current_char];

    if (d.last_char != null) { //make sure our character is talking to someone
        if (d.last_char in node_names) { // Make sure the previous character is not null
            
            // HANDLE LINKING ////////////
            var currLink = {
                    source: current_char, 
                    target: node_names[d.last_char], 
                    state: 'inactive',
                    interactions: 1
                },
                linkName = current_char.name  +'-'+ node_names[d.last_char].name;

            var last_char = node_names[d.last_char];
            if (linkNames.indexOf(linkName) == -1) {
                linkNames.push(linkName)
                links.push(currLink); // create a link

                if (current_char['links'] == undefined){
                    current_char['links'] = [];
                }

                if (last_char['links'] == undefined){
                    last_char['links'] = [];
                }

                current_char['links'].push(currLink);
                last_char['links'].push(currLink);
            } else {
                var curr_index = findLink(currLink, current_char['links']);
                current_char['links'][curr_index].interactions++;
                if (current_char['links'][curr_index].interactions > max_interactions) {
                    max_interactions = current_char['links'][curr_index].interactions;
                }
            }

            if (current_char['neighbors'] == undefined){
                current_char['neighbors'] = [];
            }

            current_char['neighbors'].push(currLink);

            
            // HANDLE SENTIMENT ///////////

            //add sentiment (or create sentiment)
            if (node_names[d.last_char].sentiment != undefined) {
                node_names[d.last_char].sentiment += d.sentiment;
            } else {
                 node_names[d.last_char].sentiment = d.sentiment;
            }
            
            // modify max_sent sentiment
            if (node_names[d.last_char].sentiment > max_sent) {
                max_sent = node_names[d.last_char].sentiment;
            }

            // modify min_sent sentiment
            if(node_names[d.last_char].sentiment < min_sent) {
                min_sent = node_names[d.last_char].sentiment;
            }
        }
    }   

    i++;
}

/**
 * Shows only neighbors of given node on graph
 * @param  {node} node - A node in our graph
 * @return {none}      none
 */
function showNeighbors(node) {
    old_nodes = nodes;
    old_links = links;
    nodes = [];
    links = [];

    svg.selectAll("text.label").remove();
    texts = texts.data(nodes);
    nodes.push(node);
    node.links.forEach(function (link) {
        if(link.source.name == node.name) {
            nodes.push(link.target);
            links.push(link);
        }
    });

    update();
}

/**
 * returns the graph back to its previous state
 * @return {none} none
 */
function unshowNeighbors() {
    nodes = old_nodes;
    links = old_links;
    update();
}

/**
 * Given a list of links and a target link it will give the index of that link
 * if it exists. Otherwise it will return false
 * @param  {link} target [The target link we are looking for]
 * @param  {list<link>} links  [The list of links we are searching through]
 * @return {int or false}        [if(int): the index of link -- false: link does not exist in links]
 */
function findLink (target, links) {
    var result = false,
        i = 0;
    links.forEach(function (link) {
        if (link.source.name==target.source.name 
            && link.target.name==target.target.name) {
            result = i;
        }
        i++;
    });
    return result;
}

/**
 * This runs on every increment of the animation in d3.
 *
 * NOTE: Use function (d) {} for grabbing properties stored in the node object.
 * 
 * @return {None} none
 */
function tick() {
    //Create link between source and target and style
    link.attr("x1", function (d) { return d.source.x; })
      .attr("y1", function (d) { return d.source.y; })
      .attr("x2", function (d) { return d.target.x; })
      .attr("y2", function (d) { return d.target.y; })
      .transition()
      .attr('style', function (d) {
          if (d.state == 'active') {
            var scale = d3.scale.linear()
              .range([1, 10])
              .domain([1, max_interactions]);

            var width = scale(d.interactions);

            return 'stroke: red; stroke-width:'+ width +'px;';
          } else {
            return 'stroke: black;'
          }
      })
      .attr('opacity', function (d) {
          if (d.state == 'active') {
              return 0.7;
          } else {
            return 1;
          }
      });

    // Update node position and color based upon sentiment
    node.attr("cx", function (d) { return d.x; })
      .attr("cy", function (d) { return d.y; })
      .attr("r", function (d) { return d.radius })
      .attr("style", function (d) {
            var scale = d3.scale.linear()
                .range([0, 255])
                .domain([min_sent, max_sent]);
            var sent = scale(d.sentiment),
                g = Math.floor(sent),
                r = Math.floor(255 - sent);
            return("fill:rgb(" + r+", "+g+",0)");
      });

    // Move text over corrisponding node (if it exists)
    if (texts != []) {
        texts.attr("transform", function (d) {
            return "translate(" + d.x + "," + d.y + ")";
        })
        .text(function (d) {  return d.name + ' (' + d.sentiment + ')';  });
    };
}


/**
 * This function updates all of our data arrays which will change how the graph
 * is desplayed
 * @return {None} none
 */
function update() {
    link = link.data(links);
    link.enter().insert("line", ".node")
        .attr("class", "link");

    link.exit().remove();

    node = node.data(nodes);

    texts = texts.data(nodes);
        

    node.enter().insert("circle", ".cursor")
        .attr("class", "node")
        .attr("r", function (d) { return d.radius; })
        .style("fill", function(d) {
            var scale = d3.scale.linear()
                .range([0, 255])
                .domain([min_sent, max_sent]);
            var sent = scale(d.sentiment),
                r = sent,
                g = 255 - sent;

            return("rgb(" + r+", "+g+",0)");
        })
        .call(force.drag);
    node.exit().remove();

    node.on('mouseover', function (d) {
        node.active = true;
        
        d.links.forEach(function (link) {
            link.state = 'active';
        });
    });

    node.on('mouseout', function (d) {
        node.active = false;
        d.links.forEach(function (link) {
            link.state = 'inactive';
        });
    });

    node.on('click', function (d) {
        if (curr_node == null) {
            d3.select('#neighbors')
              .style('display', 'block');
        }
        curr_node = d;
        showData(d);
    });

    texts.enter().append("text")
        .attr("class", "label")
        .attr("fill", "black")
        .style("pointer-events", "none")
        .text(function (d) {  return d.name + d.sentiment;  });

    texts.exit().remove();
    force.start();
}

/**
 * Populates the side panel with information on node
 * @param  {node} node [A node in our graph]
 * @return {none}      none
 */
function showData(node) {
    var info_panel = d3.select('#info').html(''),
        table_head = '<thead><tr><th>Source</th><th>Target</th><th># of Interactions<th></tr></thead>';
    info_panel.append('p')
        .html('Name: <span class="name">' + node.name + "</span>")
    info_panel.append('p')
        .html('Lines: ' + node.lines)
    info_panel.append('p')
        .html('Sentiment Score: '+node.sentiment);
    info_panel.append('table')
        .attr('class', 'table table-striped')
        .html(table_head)
          .append('tbody')
            .attr('id', 'links')
    
    node.links.forEach(function (link) {
        var text = '';
        text = link.source.name + '->' + link.target.name + ': ' + link.interactions + ' interactions';
        list = info_panel.select('#links')
          .append('tr');
        list.append('td')
            .html(link.source.name);
        list.append('td')
            .html(link.target.name);
        list.append('td')
            .html(link.interactions);
    })
    

}

/**
 * Removes given node and all connected links from graph
 * @param  {node} node [node to remove]
 * @return {none}      none
 */
function removeNode(node) {
    // loop through links and destroy them.
    for (var i = 0; i < node.links.length; i++) {
        var link = node.links[i];
        links.splice(links.indexOf(link), 1);
    }
    nodes.splice(nodes.indexOf(node), 1);
}

function pause () {
    if (!paused) {
        window.clearInterval(window.id);
        d3.select('#stop')
          .html('Resume')
          .attr('class', 'btn btn-success');
    }
}

