import * as sqlite3 from 'sqlite3';
// tslint:disable-next-line: no-var-requires
const sha = require('js-sha3')
// tslint:disable-next-line: no-var-requires
const md5 = require('js-md5')

function zalozBaze() {

    sqlite3.verbose();

    const db = new sqlite3.Database('baza.db');

    // db.run('CREATE TABLE answers (user VARCHAR(48), quiz_id INTEGER, q_id INTEGER, ans INTEGER, time NUMERIC(9,2), pen NUMERIC(9,2))');

    // db.run('DROP TABLE questions');
    // db.run('DROP TABLE quizes');
    // db.close();
    db.run('CREATE TABLE times (user VARCHAR(48), quiz_id INTEGER, start BIGINT, stop BIGINT, PRIMARY KEY(user, quiz_id));');
    db.run('CREATE TABLE wholeres (user VARCHAR(48), quiz_id INTEGER, wholetime BIGINT, PRIMARY KEY(user, quiz_id));');

    // db.run('CREATE TABLE questions (quiz_id INTEGER, q_id INTEGER, text VARCHAR(256), answer INTEGER,\
     //   penalty INTEGER, image VARCHAR(2048), PRIMARY KEY(quiz_id, q_id));');

    // db.run('CREATE TABLE hasla (user VARCHAR(48) PRIMARY KEY, pswd VARCHAR(32));');
    // db.run('CREATE TABLE quizes (id INTEGER PRIMARY KEY, name VARCHAR(64), description TEXT);');
    // db.close();
    // db.run('CREATE TABLE questions (quiz_id INTEGER, q_id INTEGER, text VARCHAR(256), answer VARCHAR(256),\
    //    penalty INTEGER, image VARCHAR(2048), PRIMARY KEY(quiz_id, q_id));');

    // mostExpensive.forEach(element => {
    //     console.log('xd')
    //     db.run(`INSERT INTO memy VALUES(${element.id}, \'${element.name}\', \'${element.price};Cena początkowa;\', \'${element.url}\')`)
    // });

    // db.run(`INSERT INTO hasla VALUES('Lukatiks', '${md5('elitarnymimuw')}')`);

    // db.run(`INSERT INTO quizes VALUES(1, 'Średniowieczny quiz')`);

    // quizcont.forEach(element => {
        // db = new sqlite3.Database('baza.db');
        // // db.run(`INSERT INTO questions VALUES(1, ${element.id}, '${element.text}', ${element.answer}, ${element.penalty}, '${element.image}')`);
        // db.run(`INSERT INTO quizes VALUES(1, 'Średniowieczny quiz', 'Twoim zadaniem będzie skojarzyć podane wydarzenia historyczne z okresu średniowiecza z latami, w których miały one miejsce. Możesz swobodnie przełączać się między pytaniami, ale na każde pytanie musisz udzielić odpowiedzi. Pamiętaj – musisz to zrobić jak najszybciej, a błędna odpowiedź skutkuje karą czasową!')`)
        db.close();
        // console.log('xd')
    // });
}

function czyscBaze() {

    sqlite3.verbose();

    const db = new sqlite3.Database('baza.db');

    // db.run('CREATE TABLE answers (user VARCHAR(48), quiz_id INTEGER, q_id INTEGER, ans INTEGER, time NUMERIC(9,2), pen NUMERIC(9,2))');

    // db.run('DROP TABLE questions');
    // db.run('DROP TABLE quizes');
    // db.close();
    db.run('DELETE FROM times');
    db.run('DELETE FROM answers');
    db.run('DELETE FROM wholeres');
    //db.run('CREATE TABLE wholeres (user VARCHAR(48), quiz_id INTEGER, wholetime BIGINT, PRIMARY KEY(user, quiz_id));');

    // db.run('CREATE TABLE questions (quiz_id INTEGER, q_id INTEGER, text VARCHAR(256), answer INTEGER,\
     //   penalty INTEGER, image VARCHAR(2048), PRIMARY KEY(quiz_id, q_id));');

    // db.run('CREATE TABLE hasla (user VARCHAR(48) PRIMARY KEY, pswd VARCHAR(32));');
    // db.run('CREATE TABLE quizes (id INTEGER PRIMARY KEY, name VARCHAR(64), description TEXT);');
    // db.close();
    // db.run('CREATE TABLE questions (quiz_id INTEGER, q_id INTEGER, text VARCHAR(256), answer VARCHAR(256),\
    //    penalty INTEGER, image VARCHAR(2048), PRIMARY KEY(quiz_id, q_id));');

    // mostExpensive.forEach(element => {
    //     console.log('xd')
    //     db.run(`INSERT INTO memy VALUES(${element.id}, \'${element.name}\', \'${element.price};Cena początkowa;\', \'${element.url}\')`)
    // });

    // db.run(`INSERT INTO hasla VALUES('Lukatiks', '${md5('elitarnymimuw')}')`);

    // db.run(`INSERT INTO quizes VALUES(1, 'Średniowieczny quiz')`);

    // quizcont.forEach(element => {
        // db = new sqlite3.Database('baza.db');
        // // db.run(`INSERT INTO questions VALUES(1, ${element.id}, '${element.text}', ${element.answer}, ${element.penalty}, '${element.image}')`);
        // db.run(`INSERT INTO quizes VALUES(1, 'Średniowieczny quiz', 'Twoim zadaniem będzie skojarzyć podane wydarzenia historyczne z okresu średniowiecza z latami, w których miały one miejsce. Możesz swobodnie przełączać się między pytaniami, ale na każde pytanie musisz udzielić odpowiedzi. Pamiętaj – musisz to zrobić jak najszybciej, a błędna odpowiedź skutkuje karą czasową!')`)
        db.close();
        // console.log('xd')
    // });
}

function zobaczBaze() {

    sqlite3.verbose();

    const db = new sqlite3.Database('baza.db');


    // db.all('SELECT id, name, prices, url FROM memy', [], (err, rows) => {

    //     if (err) throw(err);

    //     let memy = new Array(0);

    //     for(const {id, name, prices, url} of rows) {

    //     //     console.log(id, '->', name, prices, url);
    //         memy.push(doMeme(id, name, prices, url))
    //     }

    //     memy.sort((a,b) => b.prices[0].price - a.prices[0].price)

    //     memy = memy.splice(0,3);

    //     console.log(memy);

    //     db.close();

    // });

    //db.all(`SELECT quiz_id FROM times WHERE user = 'Lukatiks' AND stop > 0`, [], (err, rows) => {
    db.all(`SELECT * FROM times`, [], (err, rows) => {
        if (err) throw(err);

        // let memy = new Array(0);

        // for(const {quiz_id, q_id, text, answer,penalty, image} of rows) {
        //     console.log(quiz_id, '->', q_id, text, answer,penalty, image);
        //     // memy.push(doMeme(id, name, prices, url))
        // }

        for(const xd of rows) {
            console.log(xd)
        }

        db.close();

    });

}

// zalozBaze();

czyscBaze();
zobaczBaze();