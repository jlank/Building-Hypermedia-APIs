/* 2001-05-25 (mca) : collection+json */
/* Designing Hypermedia APIs by Mike Amundsen (2011) */

/**
 * Module dependencies.
 */

// for express
var express = require('express');
var app = express();
var cons = require('consolidate');
var partials = require('express-partials');
var protocol = 'http';
var host = 'localhost';
var port = '3000';
var site = protocol + '://' + host + ':' + port;


// for couch
var cradle = require('cradle');
var nano = require('nano')('http://localhost:5984');
var db = nano.use('collection-data-tasks');

// global data
var contentType = 'application/json';

// Configuration
app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(partials());
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.logger({format: ':response-time ms - :date - :req[x-real-ip] - :method :url :user-agent / :referrer'}));
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// register custom media type as a JSON format -- this doesn't work in express 3.x, not sure how to do this, or if it is needed
//express.bodyParser.parse['application/collection+json'] = JSON.parse;

// Routes

/* handle default task list */
app.get('/collection/tasks/', function(req, res){

  var view = '/_design/example/_view/due_date';

  db.view('example', 'due_date', function (err, doc) {
    res.header('content-type',contentType);
    res.render('tasks', {
      layout : 'layout',
      site  : site + '/collection/tasks/',
      items : doc.rows
    });
  });
});

/* filters */
app.get('/collection/tasks/;queries', function(req, res){
  res.header('content-type',contentType);
  res.render('queries', {
    layout : 'item-layout',
    site  : site + '/collection/tasks/'
  });
});

app.get('/collection/tasks/;template', function(req, res){
  res.header('content-type',contentType);
  res.render('template', {
    layout : 'item-layout',
    site  : site + '/collection/tasks/'
  });
});

app.get('/collection/tasks/;all', function(req, res){

    var view = '/_design/example/_view/all';

    db.view('example', 'all', function (err, doc) {
    res.header('content-type',contentType);
    res.render('tasks', {
      site  : site + '/collection/tasks/',
      items : doc.rows
    });
  });
});

app.get('/collection/tasks/;open', function(req, res){

    var view = '/_design/example/_view/open';

    db.view('example', 'open', function (err, doc) {
    res.header('content-type',contentType);
    res.render('tasks', {
      site  : site + '/collection/tasks/',
      items : doc.rows
    });
  });
});

app.get('/collection/tasks/;closed', function(req, res){

    var view = '/_design/example/_view/closed';

    db.view('example', 'closed', function (err, doc) {
    res.header('content-type',contentType);
    res.render('tasks', {
      site  : site + '/collection/tasks/',
      items : doc.rows
    });
  });
});

app.get('/collection/tasks/;date-range', function(req, res){

    var d1 = (req.query['date-start'] || '');
    var d2 = (req.query['date-stop'] || '');

    var options = {};
    options.startkey = d1.split('-');
    options.endkey = d2.split('-');

    var view = '/_design/example/_view/due_date';

    console.log(options)
    db.view('example', 'due_date', options, function (err, doc) {
    res.header('content-type',contentType);
    res.render('tasks', {
      site  : site + '/collection/tasks/',
      items : doc.rows,
      query : view
    });
  });
});

/* handle single task item */
app.get('/collection/tasks/:i', function(req, res){

    var id = req.params.i;

    db.get(id, function (err, doc) {
    res.header('content-type',contentType);
    res.header('etag',doc._rev);
    res.render('task', {
      layout : 'item-layout',
      site  : site + '/collection/tasks/',
      item : doc
    });
  });
});

/* handle creating a new task */
app.post('/collection/tasks/', function(req, res){

  var description, completed, dateDue, data, i, x;

  // get data array
  data = req.body.template.data;

  // pull out values we want
  for(i=0,x=data.length;i<x;i++) {
    switch(data[i].name) {
      case 'description' :
        description = data[i].value;
        break;
      case 'completed' :
        completed = data[i].value;
        break;
      case 'dateDue' :
        dateDue = data[i].value;
        break;
    }
  }

  // build JSON to write
  var item = {};
  item.description = description;
  item.completed = completed;
  item.dateDue = dateDue;
  item.dateCreated = today();

  // write to DB
  db.insert(item, function(err, doc) {
    if(err) {
      res.status=400;
      res.send(err);
    }
    else {
      res.redirect('/collection/tasks/', 302);
    }
  });
});

/* handle updating an existing task item */
app.put('/collection/tasks/:i', function(req, res) {

  var idx = (req.params.i || '');
  var rev = req.header("if-match", "*");
  var description, completed, dateDue, data, i, x;

  // get data array
  data = req.body.template.data;

  // pull out values we want
  for(i=0,x=data.length;i<x;i++) {
    switch(data[i].name) {
      case 'description' :
        description = data[i].value;
        break;
      case 'completed' :
        completed = data[i].value;
        break;
      case 'dateDue' :
        dateDue = data[i].value;
        break;
    }
  }

  // build JSON to write
  var item = {};
  item.description = description;
  item.completed = completed;
  item.dateDue = dateDue;
  item.dateCreated = today();
  item._rev = rev;

  db.insert(item, idx, function (err, doc) {
    // return the same item
    res.redirect('/collection/tasks/'+idx, 302);
  });
});

/* handle deleting existing task */
app.delete('/collection/tasks/:i', function(req, res) {
  var idx = (req.params.i || '');
  var rev = req.header("if-match", "*");

  db.destroy(idx, rev, function (err, doc) {
    if(err) {
      res.status=400;
      res.send(err);
    }
    else {
      res.status= 204;
      res.send();
    }
  });
});

function today() {
  var y, m, d, dt;

  dt = new Date();
  y = dt.getFullYear();
  m = dt.getMonth()+1;
  if(m.length===1) {
    m = '0'+m;
  }
  d = dt.getDate();
  if(d.length===1) {
    d = '0'+d;
  }
  return y+'-'+m+'-'+d;
}

// Only listen on $ node app.js
if (!module.parent) {
  app.listen(port);
  console.log("Express server listening on port %d", port);
}