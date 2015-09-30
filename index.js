/**
 * Created by jonfor on 9/29/15.
 */
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var sqlite3 = require('sqlite3').verbose();
var gcm = require('node-gcm');

app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
    extended: true
}));

var server = app.listen(8001, function() {
    var host = server.address().address;
    var port = server.address().port;
    console.log('Listening at http://%s:%s', host, port);
});

var dbFile = 'test.db';
var db = new sqlite3.Database(dbFile, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, function (err) {
    if (err) throw err;
    console.log("Opened database %s successfully", dbFile);
});

app.get('/registration/:token', function (req, res, next) {
    db.serialize(function() {
        //db.run("CREATE TABLE test (token TEXT)");
        db.get("SELECT rowid AS id, token FROM test", function(err, row) {
            if (err) throw err;
            if (row === undefined) {
                next();
            } else {
                res.send("Token already exists in database.");
                db.all("SELECT rowid AS id, token FROM test", function(err, rows) {
                    if (err) throw err;
                    console.log(rows);
                });
            }
        });
    });
}, function (req, res, next) {
    db.serialize(function() {
        var stmt = db.prepare("INSERT INTO test VALUES (?)");

        console.log("Token: " + req.params.token);
        stmt.run(req.params.token, [], function(err) {
            if (err) throw err;

            stmt.finalize();
            res.send("Inserted new token into database.");
            db.all("SELECT rowid AS id, token FROM test", function(err, rows) {
                if (err) throw err;
                console.log(rows);
            });
        });
    });
});

app.get('/message', function (req, res, next) {
    db.get("SELECT rowid AS id, token FROM test", function(err, row) {
        if (err) throw err;

        var message = new gcm.Message();
        message.addData('key1', 'msg1');

        var regIds = [row.token];

        // Set up the sender with you API key
        var sender = new gcm.Sender('AIzaSyA6ZKrlTMd8zxu8Tc0t8OXn4wSvNR6RS0E');

        // Now the sender can be used to send messages
        sender.send(message, { registrationIds: regIds }, function (err, result) {
            if (err) {
                console.error(err);
                res.status(400).send("An error occurred.");
            } else {
                console.log(result);
                res.send("Successfully pushed notification.")
            }
        });
    });
});
