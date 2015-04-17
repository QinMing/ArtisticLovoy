// [Notes on security]
// 1. The order is important
// 2. Use next() to fix order and middleware problem
// 3. Three kinds of access rights for middleware
//    > global: only GET /:id
//    > require login
//    > require vol: /enroll/*
//    > require org: otherthing
//
// GET     /new         render event/new (done)
// POST    /new         submit form create new event (done)
// GET     /:id         render event/detail (the only thing that can be viewed
//                                           without login)
// POST    /:id/delete  delete event
// GET     /:id/edit    render event/edit
// POST    /:id/edit    updeate event
// POST    /:id/enroll  enroll to event :id
// POST    /:id/enroll/delete uninroll
// GET     /            ?? to dashboard?

module.exports = function () {
  var express = require('express');
  var app = express();
  var currEvent = null;
  var validEventKeys = ["name",
                        "maxParticipant",
                        "date", "startTime", "endTime",
                        "highlight", "description",
                        "mapAddress", "mapLatitude", "mapLongitude",
                        "location"];

  function isInArray(array, value) {
    return array.indexOf(value) > -1;
  }

  app.all('/:id*', function (req, res, next) {
    alert('[app.all]: req.params.id = ' + req.params.id)
    if (req.params.id === 'new') {
      next();
    } else {
      var Event = Parse.Object.extend('Event');
      var query = new Parse.Query(Event);
      query.get(req.params.id, {
        success: function (event) {
          currEvent = event;
          next();
        },
        error: function (event, error) {
          var test;
          if (Parse.User.current()){
            test = '1';
          }else{
            test = '0';
          }
          res.send("Fail /:id*: " + error.code + error.message +'\ntest='+test);
        }
      });
    }
  });

  // render event/view, the only view not require login
  app.get('/:id', function (req, res, next) {
    if (req.params.id === 'new') {
      next();
    } else {
      // currEvent must exist now
      res.render('event/view', {event: currEvent});
    }
  });

  // middleware, require loged in as volunteer when enroll/unenroll
  app.all('/:id/enroll*', function (req, res, next) {
    if (!Parse.User.current()) {
      res.redirect('/login?redir=event-vol');
    } else if (Parse.User.current().get('group') === 2) {
      alert("vol middleware accepted");
      next();
    } else {
      alert("vol middleware rejected, redirect to dashboard");
      res.redirect('/dashboard');
    }
  });

  // enroll in event
  app.post('/:id/enroll', function (req, res) {
    var Enroll = Parse.Object.extend('Enroll');
    var enroll = new Enroll();
    enroll.set('vol', Parse.User.current());
    enroll.set('event', currEvent);
    enroll.save(null, {
      success: function (event) {
        res.redirect('/dashboard');
      },
      error: function (event, error) {
        res.redirect('/dashboard');
        // res.send('Failed to enroll, with error code: ' + error.message);
      }
    });
  });

  // unenroll in event
  app.post('/:id/enroll/delete', function (req, res) {
    alert("unenroll " + req.params.id);
    // alert(currEvent.id);
    // alert(Parse.User.current().id);
    var Enroll = Parse.Object.extend('Enroll');
    var query = new Parse.Query(Enroll);
    query.equalTo('vol', Parse.User.current());
    query.equalTo('event', currEvent);
    query.find({
      success: function (enroll) {
        if (enroll.length > 0) {
          enroll[0].destroy({
            success: function (enroll) {
              res.redirect('/dashboard');
            },
            error: function (enroll, error) {
              res.send('Failed to unenroll, error code: ' + error.message);
            }
          });
        } else {
          res.send('You have not enrolled in this event');
        }
      },
      error: function(error) {
        res.send("Fail to query " + currUser + "events");
      }
    });
  });

  // middleware, for anything else, require organization logged in
  app.all('*', function (req, res, next) {
    if (!Parse.User.current()) {
      res.redirect('/login?redir=event-org');
    } else if (Parse.User.current().get('group') === 1) {
      alert("org middleware accepted");
      next();
    } else {
      alert("org middleware rejected, redirect to dashboard");
      res.redirect('/dashboard');
    }
  });

  // testing only! shall be put after middleware
  app.get('/:eventId/checkin/:volId', function (req, res, next) {
    var Enroll = Parse.Object.extend('Enroll');
    var query = new Parse.Query(Enroll);

    var tempUser = new Parse.User();
    tempUser.id = req.params.volId;
    var Event = Parse.Object.extend('Event');
    var tempEvent = new Event();
    tempEvent.id = req.params.eventId;
    query.equalTo('vol', tempUser);
    query.equalTo('event', tempEvent);
    query.find({
      success: function (enrolls) {
        if (enrolls.length > 0) {
          // get the enroll entry
          var enroll = enrolls[0];
          enroll.set('checkedIn', true);
          enroll.save(null, {
            success: function (event) {
              // res.redirect('/' + req.params.eventId = '/manage');
              res.redirect('/event/' + req.params.eventId + '/manage');
              // res.redirect('/dashboard');
            },
            error: function (event, error) {
              res.send('Failed to save enroll, with error code: ' + error.message);
            }
          });
        } else {
          res.send('Have not enrolled in this event');
        }
      },
      error: function(error) {
        res.send("Fail to query events");
      }
    });
  });

  // render event/new
  app.get('/new', function (req, res) {
    res.render('event/edit', {event: null}); // must not include '/' in front
  });

  // submit form create new event
  app.post('/new', function (req, res) {
    var EventItem = Parse.Object.extend('Event');
    var eventItem = new EventItem();
    eventItem.set('createdBy', Parse.User.current()); // pointer to user
    // eventItem.set('name', req.body.name);
    // eventItem.set('description', req.body.description);
    for (var key in req.body) {
      if (req.body.hasOwnProperty(key) && isInArray(validEventKeys, key)) {
        eventItem.set(key, req.body[key]);
      }
    }

    var acl = new Parse.ACL();
    acl.setPublicReadAccess(true);
    acl.setPublicWriteAccess(false);
    acl.setWriteAccess(Parse.User.current(), true);
    eventItem.setACL(acl);

    eventItem.save(null, {
      success: function (event) {
        res.redirect('/dashboard');
      },
      error: function (event, error) {
        res.send('Failed to save event, with error code: ' + error.message);
      }
    });
  });

  // delete event
  app.post('/:id/delete', function (req, res) {
    if (currEvent.get('createdBy').id === Parse.User.current().id) {
      currEvent.destroy({
        success: function (event) {
          res.redirect('/dashboard');
        },
        error: function (event, error) {
          res.send('Failed to delete event, error code: ' + error.message);
        }
      });
    } else {
      res.send('Event not belong to current user.');
    }
  });

  // render event/edit
  app.get('/:id/edit', function (req, res) {
    if (currEvent.get('createdBy').id === Parse.User.current().id) {
      res.render('event/edit', {event: currEvent});
    } else {
      res.send('Event not belong to current user.');
    }
  });

  // render event/edit
  app.get('/:id/manage', function (req, res) {
    if (currEvent.get('createdBy').id === Parse.User.current().id) {
      var Enroll = Parse.Object.extend('Enroll');
      var queryEnrolled = new Parse.Query(Enroll);
      queryEnrolled.equalTo('event', currEvent);
      queryEnrolled.include('vol');

      queryEnrolled.find().then(
        function(volsPt) {
          // get all vols enrolled in this event
          var vols = new Array(volsPt.length);
          for (var i=0; i<volsPt.length; ++i) {
            vols[i] = volsPt[i].get('vol');
          }
          // get the profiles of all these vols
          var VolProfile = Parse.Object.extend('VolProfile');
          var queryVolProfile = new Parse.Query(VolProfile);
          queryVolProfile.containedIn("createdBy", vols);
          queryVolProfile.find().then(
            function(volProfiles) {
              res.render('event/manage', {
                event: currEvent,
                volProfiles: volProfiles,
                vols: vols
              });
            },
            function(error) {
              res.send("Fail to query enrolled events")
            }
          );
        },
        function(error) {
          res.send("Fail to query enrolled events")
        }
      );     
    } else {
      res.send('Event not belong to current user.');
    }
  });

  // update event
  app.post('/:id/edit', function (req, res) {
    if (currEvent.get('createdBy').id === Parse.User.current().id) {
      // currEvent.set('name', req.body.name);
      // currEvent.set('description', req.body.description);
      for (var key in req.body) {
        if (req.body.hasOwnProperty(key) && isInArray(validEventKeys, key)) {
          currEvent.set(key, req.body[key]);
        }
      }
      currEvent.save(null, {
        success: function (event) {
          res.redirect('/dashboard');
        },
        error: function (event, error) {
          res.send('Failed to save event, with error code: ' + error.message);
        }
      });
    } else {
      res.send('Event not belong to current user.');
    }
  });

  return app;

}(); // module.exports = function ()
