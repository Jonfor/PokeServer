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
var db = new sqlite3.Database(dbFile, sqlite3.OPEN_READWRITE, function (err) {
    if (err) throw err;
    console.log("Opened database %s successfully", dbFile);
});

app.get('/registration/:token', function (req, res, next) {
    db.serialize(function() {

        /* Return a message if the token is already in the database.
         * Otherwise, insert all the data into the database. */
        db.get("SELECT rowid AS id, token FROM users", function (err, row) {
            if (err) throw err;
            if (row && (row.token === req.params.token)) {
                res.send("Registration token already exists in database.");
                db.all("SELECT rowid AS id, token FROM Users", function (err, rows) {
                    if (err) throw err;
                    console.log(rows);
                });
            } else {
                next();
            }
        });
    });
}, function (req, res, next) {
    db.serialize(function() {
        console.log("Token: " + req.params.token);

        var stmtUsers = db.prepare("INSERT INTO users VALUES (?)");
        stmtUsers.run(req.params.token, [], function (err) {
            if (err) throw err;

            stmtUsers.finalize();
            db.all("SELECT rowid AS id, token FROM users", function (err, rows) {
                if (err) throw err;
                console.log("TOKENS" + JSON.stringify(rows));
            });
        });

        res.send("Inserted new token into database.");
});

    app.post('/data', function (req, res, next) {
        console.log("Frequency: " + req.body.frequency);
        console.log("Server info: " + req.body.ip, req.body.port);
        db.serialize(function () {
            var stmtFrequencies = db.prepare("INSERT INTO frequencies (frequency) VALUES($frequency)");
            stmtFrequencies.run(
                {
                    $frequency: req.body.frequency
                }, function (err) {
                    if (err) throw err;
                    stmtFrequencies.finalize();
                    db.all("SELECT rowid AS id, frequency FROM frequencies", function (err, rows) {
                        if (err) throw err;
                        console.log("FREQUENCIES: " + JSON.stringify(rows));
                    });
                });

            var stmtServers = db.prepare("INSERT INTO servers (ip, port) VALUES($ip, $port)");
            stmtServers.run(
                {
                    $ip: req.body.ip,
                    $port: req.body.port
                }, function (err) {
                    if (err) throw err;

                    stmtServers.finalize();
                    db.all("SELECT rowid AS id, ip FROM servers", function (err, rows) {
                        if (err) throw err;
                        console.log("SERVERS: " + JSON.stringify(rows));
                    });
                });

            res.send("Inserted frequency & server info into database.");
        });
    });
});

/**
 * Send message out to users.
 */
app.get('/message', function (req, res, next) {
    db.get("SELECT rowid AS id, token FROM users", function (err, row) {
        if (err) throw err;

        var message = new gcm.Message();
        message.addData('key1', 'msg1');

        var tokens = [row.token];

        // Set up the sender with you API key
        var sender = new gcm.Sender('AIzaSyA6ZKrlTMd8zxu8Tc0t8OXn4wSvNR6RS0E');

        // Now the sender can be used to send messages
        sender.send(message, {tokens: tokens}, function (err, result) {
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
