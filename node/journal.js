<script>


var express = require('express');
var multer = require('multer');
var fs = require('fs');
var passport = require('passport')
        , util = require('util')
        , DigestStrategy = require('passport-http').DigestStrategy;

var databaseUrl = "localhost/Journal";
var collections = ["counter", "volumes", "vol_counter"];
var db = require("mongojs").connect(databaseUrl, collections);

var app = express();

var admin = [
    {id: 1, username: 'user', password: 'pass'}
    , {id: 2, username: 'user', password: 'pass'}
];

function findByUsername(username, fn) {
    for (var i = 0, len = admin.length; i < len; i++) {
        var user = admin[i];
        if (user.username === username) {
            return fn(null, user);
        }
    }
    return fn(null, null);
}
;

passport.use(new DigestStrategy({qop: 'auth'},
function(username, done) {
    findByUsername(username, function(err, user) {
        if (err) {
            return done(err);
        }
        if (!user) {
            return done(null, false);
        }
        return done(null, user, user.password);
    });
},
        function(params, done) {
            // asynchronous validation, for effect...
            process.nextTick(function() {
                // check nonces in params here, if desired
                return done(null, true);
            });
        }
));

app.use(passport.initialize());
app.use('/', express.static(__dirname + '/journal'));



var nodemailer = require("nodemailer"),
        transport = nodemailer.createTransport('SMTP', {
            service: "Gmail",
            auth: {
                user: "whatever@gmail.com",
                pass: "whatever"
            }
        });

//app.use(bodyParser());
app.use(multer({
    dest: './mount_point/files',
    limits: {
        files: 3
    }
}));

app.listen(8000);

console.log("Express nodejs server listening at 8000");

app.post('/uploadFiles', function(req, res) {
    // your normal code
    var attch = [];
    if (req.files.manuscript) {
        attch.push({fileName: "(Manuscript)_" + req.files.manuscript.originalname, filePath: req.files.manuscript.path, contentType: req.files.manuscript.mimetype});
    }
    ;
    if (req.files.cover_letter) {
        attch.push({fileName: "(Cover_Letter)_" + req.files.cover_letter.originalname, filePath: req.files.cover_letter.path, contentType: req.files.cover_letter.mimetype});
    }
    ;
    if (req.files.supplementary) {
        attch.push({fileName: "(Supplementary)_" + req.files.supplementary.originalname, filePath: req.files.supplementary.path, contentType: req.files.supplementary.mimetype});
    }
    ;

    //send email now
    transport.sendMail({
        from: req.body.uploaderEmail,
        to: "manuscripts@ijbes.com",
        subject: "Manuscript Submission "+req.body.uploaderName, // Subject line
        html: "Submitter Name <b>" + req.body.uploaderName + "</b> <br/> Submitter Email <b>" + req.body.uploaderEmail + "</b>", // html body
        attachments: attch
    }, function(error, response) {
        if (error) {
            res.send(500, error);
        } else {
            if (req.files.cover_letter) {
                fs.unlink(req.files.cover_letter.path, function(err) {
                    if (err) {
                        console.log('cover letter delete fail');
                    } else {
                        console.log('cover letter successfully deleted');
                        if (req.files.manuscript) {
                            fs.unlink(req.files.manuscript.path, function(err) {
                                if (err) {
                                    console.log('manuscript delete fail');
                                } else {
                                    console.log('manuscript succesfully deleted');
                                    if (req.files.supplementary) {
                                        fs.unlink(req.files.supplementary.path, function(err) {
                                            if (err) {
                                                console.log('supplementary delete fail');
                                            } else {
                                                console.log('supplementary succesfully deleted');
                                            }
                                        });
                                    }
                                }
                            });
                        }
                    }
                });
                res.send();
            }
        }
        ;
    });
});

function today() {
    var dateNow = new Date();

    var year = dateNow.getFullYear();
    var month = getMonth(dateNow.getMonth());
    var date = dateNow.getDate();
    var day = getDay(dateNow.getDay());

    return day + " " + month + " " + date + " " + year;
}
;

function getMonth(indx) {
    var months = [
        "Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"
    ];
    return months[indx];
}
;

function getDay(indx) {
    var days = [
        "Sun", "Mon", "Tue", "Wed", "Thur", "Fri", "Sat"
    ];
    return days[indx];
}
;

function getCurrVolSess() {
    var month_now = new Date().getMonth();
    if (month_now >= 0 && month_now <= 3) {
        return 0; //first session
    } else if (month_now >= 4 && month_now <= 7) {
        return 1; //second session
    } else if (month_now >= 8 && month_now <= 11) {
        return 2;
    }
}
;

app.post('/adminUpload', passport.authenticate('digest', {session: false})
        , function(req, res) {
            if (req.files.approvedFile && req.body.authorName && req.body.title) {
                //upload to a database
                var todayDateTime = today();
                var volume = -1;
                db.counter.find({}, {next_unique_id: 1}, function(err, counter_data) {
                    if (err) {
                        res.send(500);
                    } else {
                        /*
                         db.articles.save({
                         id: counter_data[0].next_unique_id,
                         title: req.body.title,
                         author: req.body.authorName,
                         date: todayDateTime,
                         filePath: req.files.approvedFile.path
                         }, function(err, article_data) {
                         if (err) {
                         	
                         } else {
                         //increase the next unique id by 1
                         db.counter.update({next_unique_id: counter_data[0].next_unique_id},
                         {$inc: {next_unique_id: 1}}, function(err, incr_data) {
                         if (err) {
                         res.send(500);
                         } else {
                         res.send(200);
                         }
                         });
                         }
                         });*/
                        db.vol_counter.find({}, {"_id": 0}, function(err, vol_counter_data) {
                            if (err) {
                               res.send(500);
                            } else {
                                if (vol_counter_data[0].last_vol_year > new Date().getFullYear()) {
                                    volume = vol_counter_data[0].curr_vol + 1;
                                    db.volumes.save({"volume": volume, "articles": [
                                            {
                                                id: counter_data[0].next_unique_id,
                                                title: req.body.title,
                                                author: req.body.authorName,
                                                date: todayDateTime,
                                                filePath: req.files.approvedFile.path
                                            }
                                        ]}, function(err, data) {
                                        if (err) {
                                            res.send(500);
                                        } else {
                                            //increase the next unique id by 1
                                            db.counter.update({next_unique_id: counter_data[0].next_unique_id},
                                            {$inc: {next_unique_id: 1}}, function(err, incr_data) {
                                                if (err) {
                                                    res.send(500);
                                                } else {
                                                    db.vol_counter.update({}, {
                                                        "curr_vol": volume,
                                                        "last_vol_year": new Date().getFullYear(),
                                                        "last_vol_session": getCurrVolSess()
                                                    }, function(err, data) {
                                                        if (err) {
							    res.send(500);
                                                        } else {
                                                            res.send(200);
                                                        }
                                                    });
                                                }
                                            });
                                        }
                                    });
                                } else if (vol_counter_data[0].last_vol_year === new Date().getFullYear()) {
                                    if (getCurrVolSess() === vol_counter_data[0].last_vol_session) {
                                        volume = vol_counter_data[0].curr_vol;
                                        db.volumes.update({"volume": volume}, {$push: {"articles": {
                                                    id: counter_data[0].next_unique_id,
                                                    title: req.body.title,
                                                    author: req.body.authorName,
                                                    date: todayDateTime,
                                                    filePath: req.files.approvedFile.path
                                                }}}, function(err, data) {
                                            if (err) {
                                                res.send(500);
                                            } else {
                                                //increase the next unique id by 1
                                                db.counter.update({next_unique_id: counter_data[0].next_unique_id},
                                                {$inc: {next_unique_id: 1}}, function(err, incr_data) {
                                                    if (err) {
                                                        res.send(500);
                                                    } else {
                                                        db.vol_counter.update({}, {
                                                            "curr_vol": volume,
                                                            "last_vol_year": new Date().getFullYear(),
                                                            "last_vol_session": getCurrVolSess()
                                                        }, function(err, data) {
                                                            if (err) {
                                                                res.send(500);
                                                            } else {
                                                                res.send(200);
                                                            }
                                                        });
                                                    }
                                                });
                                            }
                                        });

                                    } else {
                                        volume = vol_counter_data[0].curr_vol + 1;
                                        db.volumes.save({"volume": volume, "articles": [
                                                {
                                                    id: counter_data[0].next_unique_id,
                                                    title: req.body.title,
                                                    author: req.body.authorName,
                                                    date: todayDateTime,
                                                    filePath: req.files.approvedFile.path
                                                }
                                            ]}, function(err, data) {
                                            if (err) {
                                                res.send(500);
                                            } else {
                                                //increase the next unique id by 1
                                                db.counter.update({next_unique_id: counter_data[0].next_unique_id},
                                                {$inc: {next_unique_id: 1}}, function(err, incr_data) {
                                                    if (err) {
                                                        res.send(500);
                                                    } else {
                                                        db.vol_counter.update({}, {
                                                            "curr_vol": volume,
                                                            "last_vol_year": new Date().getFullYear(),
                                                            "last_vol_session": getCurrVolSess()
                                                        }, function(err, data) {
                                                            if (err) {
                                                                res.send(500);
                                                            } else {
                                                                res.send(200);
                                                            }
                                                        });
                                                    }
                                                });
                                            }
                                        });
                                    }
                                } else {
                                    volume = vol_counter_data[0].curr_vol + 1;
                                        db.volumes.save({"volume": volume, "articles": [
                                                {
                                                    id: counter_data[0].next_unique_id,
                                                    title: req.body.title,
                                                    author: req.body.authorName,
                                                    date: todayDateTime,
                                                    filePath: req.files.approvedFile.path
                                                }
                                            ]}, function(err, data) {
                                            if (err) {
                                                res.send(500);
                                            } else {
                                                //increase the next unique id by 1
                                                db.counter.update({next_unique_id: counter_data[0].next_unique_id},
                                                {$inc: {next_unique_id: 1}}, function(err, incr_data) {
                                                    if (err) {
                                                        res.send(500);
                                                    } else {
                                                        db.vol_counter.update({}, {
                                                            "curr_vol": volume,
                                                            "last_vol_year": new Date().getFullYear(),
                                                            "last_vol_session": getCurrVolSess()
                                                        }, function(err, data) {
                                                            if (err) {
                                                                res.send(500);
                                                            } else {
                                                                res.send(200);
                                                            }
                                                        });
                                                    }
                                                });
                                            }
                                        });
                                }
                            }
                        });
                    }
                });
            }
            ;
        });

app.get('/admin', passport.authenticate('digest', {session: false})
        , function(req, res) {
            res.sendfile(__dirname + '/journal/admin.html');
        });

app.get('/volumes', function(req, res) {
    db.volumes.find({}, {volume: 1, _id: 0}, function(err, data) {
        if (err) {
            res.send(500);
        } else {
            res.send(data);
        }
    });
});

app.get('/volumes/:vol', function(req, res) {
    if (/^[0-9]+$/.test(req.params.vol)) {
        db.volumes.find({"volume": parseInt(req.params.vol)}, {_id: 0}, function(err, data) {
            if (err) {
                res.send(500);
            } else {
                res.send(data[0]);
            }
        });
    }
});
/*
app.get('/articles', function(req, res) {
    var curr_max_id = -1;
    if (/^[0-9]+$/.test(req.query.curr_max_id)) {
        curr_max_id = parseInt(req.query.curr_max_id);
        db.articles.find({$query: {id: {$lt: curr_max_id}}, $orderby: {"id": -1}}, {_id: 0})
                .limit(3, function(err, data) {
                    if (err) {
                        res.send(500);
                    } else {
                        res.send(data);
                    }
                });
    } else {
        db.articles.find({$query: {}, $orderby: {"id": -1}}, {_id: 0})
                .limit(3, function(err, data) {
                    if (err) {
                        res.send(500);
                    } else {
                        res.send(data);
                    }
                });
    }

});
*/

app.get('/latest_articles', function(req, res) {
    db.volumes.findOne({$query: {}, $orderby: {"volume": -1}}, {"_id": 0}, function(err, data) {
        if(err) {
           
        }else{
           res.send(data);
        }
    });
});

app.get('/mount_point/files/:fileName', function(req, res) {
    res.header("Content-Type", "application/pdf");
    res.sendfile(__dirname + '/mount_point/files/' + req.params.fileName);
});

app.post('/feedback', function(req, res) {
    if (req.query.name && req.query.email && req.query.feedback) {
        transport.sendMail({
            from: req.query.email,
            to: "manuscripts@ijbes.com",
            subject: "User Feedback → " + req.query.name, // Subject line
            html: "Submitter Name→ <b>" + req.query.name + "</b> <br/> Submitter Email→ <b>" + req.query.email + "</b><br/>" + "<p><b>Feedback→ </b>" + req.query.feedback + "</p>", // html body
        }, function(error, response) {
            if(error){
                res.send(500);
            } else {
                res.send(200);
            }
        });
    }
});

</script>
