import csurf from 'csurf'
import cookieParser from 'cookie-parser'
import session from 'express-session'
// tslint:disable-next-line: no-var-requires
const csql3 = require('connect-sqlite3');
// tslint:disable-next-line: no-var-requires
const sha = require('js-sha3')
import * as sqlite3 from 'sqlite3';
import express from 'express';
import {promisify} from 'util'

import {
    run,
    beginUntilPasses,
    beginExclusiveTransaction,
    passwordChangeError,
    checkPasswordChanged,
    renderError,
    internalServerError,
    sqlQuery,
    haveToLogIn,
    isProperUsername
} from './functions'

const sqliteStore = csql3(session);
const app = express();
const secretlySecretValue = 'Gotta catch\'em all!';
const csrfProtection = csurf({cookie:true});

app.use(cookieParser(secretlySecretValue));

app.use(express.static('public'));

app.use(express.json());

app.use(session({secret: secretlySecretValue,
    cookie: { maxAge: 15*60*1000 },
    resave: false,
    saveUninitialized: true,
    store: new sqliteStore()
}))


app.use(express.urlencoded({
  extended: true
}));

app.use((req, res, next) => {
  if (!req.session?.zalogowany) {
    req.session.zalogowany = {};
  }
  next();
});

app.set('view engine', 'pug');

const prepareList = (
        rows2: any[],
        rows3: any[]
) => {
    const quizy = new Array(0);

    for(const {id, name, description} of rows2) {
        quizy.push({
            id,
            name,
            description
        })
    }

    const done = new Array(0);
    const notdone = new Array(0);

    for(const {quiz_id} of rows3) {
        done.push({
            id: quiz_id,
            name: null,
            description: null
        })
    }

    let i = 0;
    let j = 0;

    while (i < quizy.length) {
        if (done.length !== j && quizy[i].id === done[j].id) {
            done[j].name = quizy[i].name;
            done[j].description = quizy[i].description;
            j++;
        } else {
            notdone.push(quizy[i]);
        }
        i++;
    }

    return {
        notdone,
        done
    }
};
// Strona główna
app.get('/', (req, res) => {
    // W przypadku gdy ktoś nie jest zalogowany, wymagamy zalogowania
    haveToLogIn(req, res, () => {
        sqlite3.verbose();

        const db = new sqlite3.Database('baza.db');

        checkPasswordChanged(
            db, req, res,
            () => {
                sqlQuery(db, req, res, 'SELECT id, name, description FROM quizes ORDER BY id',
                (rows2:any[]) => {
                    sqlQuery(db, req, res, `SELECT DISTINCT quiz_id FROM answers
                        WHERE user = '${req.session.zalogowany.username}'
                        ORDER BY quiz_id`,
                        (rows3:any[]) => {

                        db.close();

                        const lista = prepareList(rows2, rows3);

                        res.render('glowna', {
                            quizes: lista.notdone,
                            done: lista.done,
                            user: req.session.zalogowany.username
                        })
                    });
                });
            }
        )
    });
});

// Próba przekierowania na stronę główną po zalogowaniu
app.post('/', (req, res) => {

    if (isProperUsername(req.body.username) === false) {
        renderError(req, res, 'Bad username, should be letters and numbers only');
        return;
    }

    sqlite3.verbose();

    const db = new sqlite3.Database('baza.db');
    sqlQuery(db, req, res, `SELECT user, pswd, paskey FROM hasla WHERE user LIKE '${req.body.username}'`,
        (rows:any[]) => {

        if (rows.length < 1) {
            db.close();
            res.render('logowanie', {error: 'Invalid username'});
            return;
        }

        // Sprawdzenie, czy hasła się zgadzają
        if (rows[0].pswd === sha.sha3_256(req.body.password)) {
            // Zapisanie danych o zalogowanym
            req.session.zalogowany = {
                username: req.body.username,
                paskey: rows[0].paskey
            };

            // tworzymy listę quizów
            sqlQuery(db, req, res, `SELECT id, name, description FROM quizes ORDER BY id`,
                (rows2:any[]) => {

                sqlQuery(db, req, res, `SELECT DISTINCT quiz_id FROM answers
                    WHERE user = '${req.session.zalogowany.username}'
                    ORDER BY quiz_id`,
                    (rows3:any[]) => {

                    db.close()

                    const lista = prepareList(rows2, rows3);

                    res.render('glowna', {
                        quizes: lista.notdone,
                        done: lista.done,
                        user: req.session.zalogowany.username
                    })
                });
            });
        } else {
            db.close();
            res.render('logowanie', {error: 'Invalid password'});
        }
    });
})

app.get('/logout', (req, res) => {
    req.session.zalogowany = {};
    res.render('logowanie', {ok: 'Wylogowano pomyślnie'});
});

// wejście na stronę zmiany hasła
app.get('/chpsw', csrfProtection, (req, res) => {
    haveToLogIn(req, res, () => {
        sqlite3.verbose();

        const db = new sqlite3.Database('baza.db');

        checkPasswordChanged(
            db, req, res,
            () => {
                res.render('zmienhaslo2', {
                    csrfToken: req.csrfToken(),
                    nazwa: req.session.zalogowany.username
                })
            }
        );
    });
});

// próba zmiany hasła
app.post('/chpsw', csrfProtection, (req, res) => {

    if (isProperUsername(req.body.username) === false) {
        renderError(req, res, 'Bad username, should be letters and numbers only');
        return;
    }

    sqlite3.verbose();

    const db = new sqlite3.Database('baza.db');

    beginExclusiveTransaction(db, req, res, () => {

        db.all(`SELECT user, pswd FROM hasla WHERE user = '${req.body.username}'`,
            [], (err21, rows) => {

            if (err21) {
                db.run('ROLLBACK', () => {
                    internalServerError(req, res);
                    return;
                });
            } else if (rows.length < 1) {
                passwordChangeError(db, req, res, 'No such user');
            } else if (sha.sha3_256(req.body.oldpassword) !== rows[0].pswd) {
                passwordChangeError(db, req, res, 'Old password is invalid');
            } else if (req.body.newpassword1.length < 1) {
                passwordChangeError(db, req, res, 'Password cannot be empty');
            } else if (req.body.newpassword1 !== req.body.newpassword2) {
                passwordChangeError(db, req, res, 'New passwords do not match');
            } else {
                db.all(`UPDATE hasla SET
                        pswd = \'${sha.sha3_256(req.body.newpassword1)}\',
                        paskey = '${sha.sha3_256(new Date().toString())}'
                        WHERE user = '${req.body.username}'`,
                    [], (err2) => {
                    if (err2) {
                        db.run('ROLLBACK', () => {
                            {
                                internalServerError(req, res);
                                return;
                            }
                        });
                    } else {
                        db.run('COMMIT', () => {
                            db.close();
                            res.render('zmienhaslo2', {
                                ok: 'Hasło pomyślnie zmienione',
                                csrfToken: req.csrfToken(),
                                nazwa: req.body.username
                            })
                        });
                    }
                });
            }
        });
    })
});

// rozpoczęcie/wznowienie quizu
app.get('/quiz/:quizId', csrfProtection, (req, res) => {
    haveToLogIn(req, res, () => {
        sqlite3.verbose();

        if (isNaN(Number(req.params.quizId)) === true) {
            renderError(req, res, 'Bad quiz number value');
            return;
        }

        const db = new sqlite3.Database('baza.db');

        checkPasswordChanged(
            db, req, res,
            () => {
                const quizcont = new Array(0);
                let description:string;
                let backgroundurl:string;
                let title:string;

                // sprawdzamy, czy quiz się nie skończył
                sqlQuery(db, req, res, `SELECT * FROM times
                    WHERE quiz_id = ${req.params.quizId}
                    AND user = '${req.session.zalogowany.username}'`,
                    (rows3:any[]) => {

                    // przypadek, gdy dla quizu figuruje już czas zakończenia
                    if (rows3.length > 0 && rows3[0].stop !== 0) {
                        renderError(req, res, 'Nie można drugi raz w ten sam quiz');
                        return;
                    }

                    // pobieramy potrzebne informacje do pytań
                    sqlQuery(db, req, res, `SELECT q_id, text, penalty, image FROM questions
                        WHERE quiz_id = ${req.params.quizId}`,
                        (rows:any[]) => {

                        if (rows.length === 0) {
                            renderError(req, res, '404 Not Found');
                            return;
                        }

                        // pobieramy informacje o samym quizie
                        sqlQuery(db, req, res, `SELECT name, description, backgroundurl FROM quizes
                            WHERE id = ${req.params.quizId}`,
                            (rows2:any[]) => {

                            title = rows2[0].name;
                            description = rows2[0].description;
                            backgroundurl = rows2[0].backgroundurl;

                            // przygotowujemy JSON-a z odpowiedziami
                            for(const {q_id, text, penalty, image} of rows) {
                                quizcont.push({
                                    id: q_id,
                                    text,
                                    answer: null,
                                    penalty,
                                    image
                                })
                            }

                            // jeżeli quiz nie został jeszcze rozpoczęty, musimy dodać informacje
                            // o czasie startu
                            if (rows3.length === 0) {
                                const start = Number(new Date());

                                beginExclusiveTransaction(db, req, res, () => {

                                    db.run(`INSERT INTO times VALUES
                                            ('${req.session.zalogowany.username}',
                                                ${req.params.quizId},
                                                ${start},
                                                0)`,(err12) => {
                                        if (err12) {
                                            db.run('ROLLBACK', () => {
                                                db.close();
                                                renderError(req, res, 'Database error');
                                            });
                                        } else {
                                            db.run('COMMIT', () => {
                                                db.close();
                                                res.render('samquiz', {
                                                    csrfToken: req.csrfToken(),
                                                    description, backgroundurl,
                                                    quiz:JSON.stringify(quizcont),
                                                    id:req.params.quizId,
                                                    start:new Date(start).toString().substr(16, 8),
                                                    title
                                                })
                                            })
                                        }
                                    });
                                })
                            } else {
                                res.render('samquiz', {
                                    csrfToken: req.csrfToken(),
                                    description, backgroundurl,
                                    quiz:JSON.stringify(quizcont),
                                    id:req.params.quizId,
                                    start:new Date(rows3[0].start).toString().substr(16, 8),
                                    title
                                })
                            }
                        });
                    });
                });
            }
        );
    })
})

// koniec quizu
app.post('/quiz/:quizId/end', csrfProtection, (req, res) => {
    const now = Number(new Date());
    let taken: number;
    let penalty = 0;
    haveToLogIn(req, res, () => {
        sqlite3.verbose();

        if (isNaN(Number(req.params.quizId)) === true) {
            renderError(req, res, 'Bad quiz number value');
            return;
        }

        const db = new sqlite3.Database('baza.db');

        checkPasswordChanged(
            db, req, res,
            () => {
                const result = req.body;

                sqlQuery(db, req, res, `SELECT * FROM times
                    WHERE quiz_id = ${req.params.quizId}
                    AND user = '${req.session.zalogowany.username}'`,
                    (rows3:any[]) => {

                    if (rows3[0].stop !== 0) {
                        renderError(req, res, 'Test already solved');
                        return;
                    }

                    taken = (now - rows3[0].start) / 1000;

                    sqlQuery(db, req, res, `SELECT q_id, answer, penalty FROM questions
                        WHERE quiz_id = ${req.params.quizId}
                        ORDER BY q_id`,
                        (rows2:any[]) => {

                        if (rows2.length !== result.length) {
                            internalServerError(req, res);
                            return;
                        }

                        const anses:string[] = [
                            `UPDATE times SET stop = ${now}`,
                            `INSERT INTO wholeres VALUES
                            ('${req.session.zalogowany.username}',
                            ${req.params.quizId},
                            ${taken + penalty})`,
                        ];

                        for (let j = 0; j < result.length; j++) {
                            if (result[j].questionID !== rows2[j].q_id) {
                                internalServerError(req, res);
                                return;
                            }

                            if (Number(rows2[j].answer) === Number(result[j].answer)) {
                                anses.push(
                                    `INSERT INTO answers VALUES('${req.session.zalogowany.username}',
                                    ${req.params.quizId}, ${result[j].questionID}, '${result[j].answer}',
                                    ${result[j].time * taken}, 0)`
                                );
                            } else {
                                anses.push(
                                    `INSERT INTO answers VALUES('${req.session.zalogowany.username}',
                                    ${req.params.quizId}, ${result[j].questionID}, '${result[j].answer}',
                                    ${result[j].time * taken}, ${rows2[j].penalty})`
                                );
                                penalty += rows2[j].penalty;
                            }
                        }

                        const mainTrans = async () => {
                            for (const ans of anses) {
                                await run(db)(ans);
                            }
                            await run(db)('COMMIT');
                            res.render('poquizie', {
                                csrfToken: req.csrfToken(),
                                id:req.params.quizId,
                                user: req.session.zalogowany.username,
                                result:JSON.stringify(result)
                            })
                        }

                        beginUntilPasses(db, mainTrans, () => {
                            internalServerError(req, res);
                            return;
                        });
                    })
                })
            }
        );
    })
})

// wejście w statystyki
app.get('/stats/:quizId/:username', csrfProtection, (req, res) => {
    haveToLogIn(req, res, () => {
        // sprawdzenie poprawności argumentów
        if (isNaN(Number(req.params.quizId)) === true) {
            renderError(req, res, 'Bad quiz number value');
            return;
        }

        if (isProperUsername(req.params.username) === false) {
            renderError(req, res, 'Bad username, should be letters and numbers only');
            return;
        }

        sqlite3.verbose();

        const db = new sqlite3.Database('baza.db');

        checkPasswordChanged(
            db, req, res,
            () => {
                const top = new Array(0);
                const stats = new Array(0);
                sqlQuery(db, req, res, `SELECT name, backgroundurl FROM quizes
                    WHERE id=${req.params.quizId}`,
                    (rows8:any[]) => {

                    if (rows8.length < 1) {
                        renderError(req, res, '404 Not Found');
                        return;
                    }

                    sqlQuery(db, req, res, `SELECT user, wholetime FROM wholeres
                        WHERE quiz_id = ${req.params.quizId}
                        ORDER BY wholetime`,
                        (rows:any[]) => {

                        if (rows.length === 0) {
                            renderError(req, res, '404 Not Found');
                            return;
                        }

                        sqlQuery(db, req, res, `SELECT q_id, ans, time, pen FROM answers
                            WHERE quiz_id = ${req.params.quizId}
                            AND user LIKE '${req.params.username}'
                            ORDER BY q_id`,
                            (rows2:any[]) => {

                            if (rows2.length === 0) {
                                renderError(req, res, '404 Not Found');
                                return;
                            }


                            sqlQuery(db, req, res, `SELECT q_id, text, answer FROM questions
                                WHERE quiz_id = ${req.params.quizId}
                                ORDER BY q_id`,
                                (rows3:any[]) => {

                                if (rows2.length !== rows3.length) {
                                    internalServerError(req, res);
                                    return;
                                }

                                sqlQuery(db, req, res, `SELECT q_id, AVG(time) as time FROM answers
                                    WHERE quiz_id = ${req.params.quizId}
                                    AND pen=0
                                    GROUP BY q_id
                                    ORDER BY q_id`,
                                    (rows4:any[]) => {

                                    let i = 0;
                                    while(i < 5 && i < rows.length) {
                                        top.push({
                                            name: rows[i].user,
                                            score: rows[i].wholetime.toFixed(2)
                                        })
                                        i++;
                                    }

                                    i = 0;
                                    let j = 0;
                                    while (i < rows3.length) {
                                        let txt;

                                        if (rows3[i].text.length <= 24) {
                                            txt = `${rows3[i].text}`
                                        } else {
                                            txt= '…' + `${rows3[i].text}`.slice(-24);
                                        }

                                        if (rows4.length > j && rows4[j].q_id === rows3[i].q_id) {
                                            stats.push({
                                                id: rows2[i].q_id,
                                                text: txt,
                                                userans: rows2[i].ans,
                                                goodans: rows3[i].answer,
                                                time: rows2[i].time.toFixed(2),
                                                penalty: rows2[i].pen,
                                                avgtime: rows4[j].time.toFixed(2)
                                            });
                                            j++;
                                        } else {
                                            stats.push({
                                                id: rows2[i].q_id,
                                                text: txt,
                                                userans: rows2[i].ans,
                                                goodans: rows3[i].answer,
                                                time: rows2[i].time.toFixed(2),
                                                penalty: rows2[i].pen,
                                                avgtime: "b.d."
                                            });
                                        }

                                        i++;
                                    }
                                    db.close();
                                    res.render('statystyki', {
                                        csrfToken: req.csrfToken(),
                                        top, stats,
                                        id: req.params.quizId,
                                        name:rows8[0].name,
                                        backgroundurl:rows8[0].backgroundurl
                                    })
                                })
                            })
                        })
                    })
                })
            }
        );
    })
});

// strony, których nie ma
app.get('/*', csrfProtection, (req, res) => {
    renderError(req, res, '404 Not Found');
});

module.exports = app;