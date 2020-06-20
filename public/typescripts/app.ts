import csurf from 'csurf'
import cookieParser from 'cookie-parser'
import session from 'express-session'
// tslint:disable-next-line: no-var-requires
const csql3 = require('connect-sqlite3');
// tslint:disable-next-line: no-var-requires
const sha = require('js-sha3')
import * as sqlite3 from 'sqlite3';
import express from 'express';

const sqliteStore = csql3(session);
const app = express();
const secretlySecretValue = 'Gotta catch\'em all!';
const csrfProtection = csurf({cookie:true});

import {promisify} from 'util'
const run = (dab:sqlite3.Database) => promisify(dab.run.bind(dab));

// Wykonanie sekwencji instrukcji niebędących selectami, zwracająca pierwszy błąd
const seqSql = (db:sqlite3.Database, comm:string[], next: ()=>Promise<void>) => {
    if (comm.length < 1) {
        throw new Error("Too little args");
    } else if (comm.length === 1) {
        db.run(comm[0], (err) => {
            if (err) throw err;
            next();
        })
    } else {
        db.run(comm[0], (err) => {
            if (err) throw err;
            seqSql(db, comm.slice(1), next);
        })
    }
};

const beginUntilPasses = (db:sqlite3.Database, next:()=>void) => {
    db.run('BEGIN EXCLUSIVE TRANSACTION', (err) => {
        if (err) {
            beginUntilPasses(db, next);
        } else {
            next();
        }
    })
}

app.use(cookieParser(secretlySecretValue));

app.use(express.static('public'));

app.use(session({secret: secretlySecretValue,
    cookie: { maxAge: 15*60*1000},
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

    try {
        // W przypadku gdy ktoś nie jest zalogowany, wymagamy zalogowania
        if (!req.session.zalogowany?.username) {
            res.render('logowanie', {error: ''});
        } else {
            sqlite3.verbose();

            const db = new sqlite3.Database('baza.db');

            // Trzeba też sprawdzać, czy od utworzenia sesji hasło nie zostało zmienione
            db.all(`SELECT paskey FROM hasla WHERE user = '${req.session.zalogowany.username}'`,
                 [], (err7, rows7) => {
                if (err7) {
                    res.render('error', {
                        message: 'Internal server error',
                        csrfToken: req.csrfToken()
                    });
                    return;
                }

                if (rows7[0].paskey !== req.session.zalogowany.paskey) {
                    res.render('logowanie', {error: 'Hasło zostało zmienione'});
                } else {
                    // tworzymy listę quizów
                    db.all('SELECT id, name, description FROM quizes ORDER BY id',
                     [], (err2, rows2) => {

                        if (err2) {
                            res.render('error', {
                                message: 'Internal server error',
                                csrfToken: req.csrfToken()
                            });
                            return;
                        }

                        db.all(`SELECT DISTINCT quiz_id FROM answers WHERE user = '${req.session.zalogowany.username}' ORDER BY quiz_id`,
                            [], (err3, rows3) => {

                            if (err3) {
                                res.render('error', {
                                    message: 'Internal server error',
                                    csrfToken: req.csrfToken()
                                });
                                return;
                            }

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
            });
        }
    } catch {
        res.render('error', {
            message: '404 Not Found',
            csrfToken: req.csrfToken()
        });
    }

});

// Próba przekierowania na stronę główną po zalogowaniu
app.post('/', (req, res) => {
    sqlite3.verbose();

    const db = new sqlite3.Database('baza.db');

    try {
      db.all(`SELECT user, pswd, paskey FROM hasla WHERE user LIKE '${req.body.username}'`,
        [], (err, rows) => {

        if (rows.length < 1) {
            db.close();
            res.render('logowanie', {error: 'Invalid username'});
        } else {
            if (err) {
                res.render('error', {
                    message: 'Internal server error',
                    csrfToken: req.csrfToken()
                });
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
                db.all('SELECT id, name, description FROM quizes ORDER BY id',
                    [], (err2, rows2) => {

                    if (err2) {
                        res.render('error', {
                            message: 'Internal server error',
                            csrfToken: req.csrfToken()
                        });
                        return;
                    }

                    db.all(`SELECT DISTINCT quiz_id FROM answers WHERE user = '${req.session.zalogowany.username}' ORDER BY quiz_id`,
                    [], (err3, rows3) => {

                        if (err3) {
                            res.render('error', {
                                message: 'Internal server error',
                                csrfToken: req.csrfToken()
                            });
                            return;
                        }
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
          }
      });
    } catch {
      res.render('error', {
          message: '404 Not Found',
          csrfToken: req.csrfToken()
        });
    }
  })

app.get('/logout', (req, res) => {
    req.session.zalogowany = {};
    res.render('logowanie', {ok: 'Wylogowano pomyślnie'});
});

// wejście na stronę zmiany hasła
app.get('/chpsw', csrfProtection, (req, res) => {
    try {
        if (!req.session.zalogowany?.username) {
            res.render('logowanie', {error: ''});
        } else {
            sqlite3.verbose();

            const db = new sqlite3.Database('baza.db');

            db.all(`SELECT paskey FROM hasla WHERE user = '${req.session.zalogowany.username}'`,
                [], (err7, rows7) => {

                if (err7) {
                    res.render('error', {
                        message: 'Internal server error',
                        csrfToken: req.csrfToken()
                    });
                    return;
                }

                if (rows7[0].paskey !== req.session.zalogowany.paskey) {
                    res.render('logowanie', {error: 'Hasło zostało zmienione, sesja przerwana'});
                } else {
                    res.render('zmienhaslo2', {
                        csrfToken: req.csrfToken(),
                        nazwa: req.session.zalogowany.username
                    })
                }
            });
        }
    } catch {
        res.render('error', {
            message: '404 Not Found',
            csrfToken: req.csrfToken(),
            user: req.session.zalogowany.username
        });
    }
});

// próba zmiany hasła
app.post('/chpsw', csrfProtection, (req, res) => {
    sqlite3.verbose();

    const db = new sqlite3.Database('baza.db');

    db.run('BEGIN EXCLUSIVE TRANSACTION', [], (err)=> {
        if (err) {
            res.render('error', {
                message: 'Internal server error. Password din not change',
                csrfToken: req.csrfToken()
            });
            return;
        };

        db.all(`SELECT user, pswd FROM hasla WHERE user = '${req.body.username}'`,
            [], (err, rows) => {

            if (err) {
                db.run('ROLLBACK', () => {
                    res.render('error', {
                        message: 'Internal server error. Password din not change',
                        csrfToken: req.csrfToken()
                    });
                    return;
                });
            } else if (rows.length < 1) {
                db.run('ROLLBACK', () => {
                    res.render('zmienhaslo2', {
                        error: 'No such user',
                        csrfToken: req.csrfToken(),
                        nazwa: req.body.username
                    });
                });
            } else if (sha.sha3_256(req.body.oldpassword) !== rows[0].pswd) {
                db.run('ROLLBACK', () => {
                    res.render('zmienhaslo2', {
                        error: 'Old password is invalid',
                        csrfToken: req.csrfToken(),
                        nazwa: req.body.username
                    });
                });
            } else if (req.body.newpassword1.length < 1) {
                db.run('ROLLBACK', () => {
                    res.render('zmienhaslo2', {
                        error: 'Password cannot be empty',
                        csrfToken: req.csrfToken(),
                        nazwa: req.body.username
                    });
                });
            } else if (req.body.newpassword1 !== req.body.newpassword2) {
                db.run('ROLLBACK', () => {
                    res.render('zmienhaslo2', {
                        error: 'New passwords do not match',
                        csrfToken: req.csrfToken(),
                        nazwa: req.body.username
                    });
                });
            } else {
                db.all(`UPDATE hasla SET pswd = \'${sha.sha3_256(req.body.newpassword1)}\', paskey = '${sha.sha3_256(new Date().toString())}' WHERE user = '${req.body.username}'`,
                    [], (err2) => {
                    if (err2) {
                        db.run('ROLLBACK', () => {
                            {
                                res.render('error', {
                                    message: 'Internal server error. Password did not change',
                                    csrfToken: req.csrfToken()
                                });
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
    if (!req.session.zalogowany?.username) {
        res.render('logowanie', {error: ''});
    } else {
        sqlite3.verbose();

        const db = new sqlite3.Database('baza.db');

        db.all(`SELECT paskey FROM hasla WHERE user = '${req.session.zalogowany.username}'`,
            [], (err7, rows7) => {

            if (err7) {
                res.render('error', {
                    message: 'Internal server error',
                    csrfToken: req.csrfToken()
                });
                return;
            }

            if (rows7[0].paskey !== req.session.zalogowany.paskey) {
                res.render('logowanie', {error: 'Hasło zostało zmienione'});
            } else {
                const quizcont = new Array(0);
                let description:string;
                let backgroundurl:string;
                let title:string;

                db.all(`SELECT * FROM times WHERE quiz_id = ${req.params.quizId} AND user = '${req.session.zalogowany.username}'`,
                    [], (err3, rows3) => {

                    if(err3) {
                        res.render('error', {
                            message: 'Internal server error',
                            csrfToken: req.csrfToken()
                        });
                        return;
                    }

                    if (rows3.length > 0 && rows3[0].stop !== 0) {
                        res.render('error', {
                            message: 'Nie można drugi raz w ten sam quiz',
                            csrfToken: req.csrfToken()
                        })
                    } else {
                        db.all(`SELECT q_id, text, penalty, image FROM questions WHERE quiz_id = ${req.params.quizId}`,
                            [], (err, rows) => {

                            if (err) {
                                res.render('error', {
                                    message: 'Internal server error',
                                    csrfToken: req.csrfToken()
                                });
                                return;
                            }

                            if (rows.length === 0) {
                                res.render('error', {
                                    message: '404 Not Found',
                                    csrfToken: req.csrfToken()
                                });
                                return;
                            }

                            db.all(`SELECT name, description, backgroundurl FROM quizes WHERE id = ${req.params.quizId}`,
                                [], (err2, rows2) => {

                                if (err2) {
                                    res.render('error', {
                                        message: 'Internal server error',
                                        csrfToken: req.csrfToken()
                                    });
                                    return;
                                }

                                title = rows2[0].name;
                                description = rows2[0].description;
                                backgroundurl = rows2[0].backgroundurl;

                                for(const {q_id, text, penalty, image} of rows) {
                                    quizcont.push({
                                        id: q_id,
                                        text,
                                        answer: null,
                                        penalty,
                                        image
                                    })
                                }

                                if (rows3.length === 0) {
                                    const start = Number(new Date());

                                    db.run('BEGIN EXCLUSIVE TRANSACTION', (err11) => {
                                        if (err11) {
                                            res.render('error', {
                                                message: 'Internal server error',
                                                csrfToken: req.csrfToken()
                                            });
                                            return;
                                        }
                                        try {
                                            db.run(`INSERT INTO times VALUES('${req.session.zalogowany.username}', ${req.params.quizId}, ${start}, 0)`,(err12) => {
                                                if (err12) {
                                                    res.render('error', {
                                                        message: 'Internal server error',
                                                        csrfToken: req.csrfToken()
                                                    });
                                                    return;
                                                }
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
                                            });
                                        } catch {
                                            db.run('ROLLBACK', () => {
                                                db.close();
                                                res.render('error', {
                                                    message: 'Database error',
                                                    csrfToken: req.csrfToken(),
                                                    user: req.session.zalogowany.username
                                                });
                                            });
                                        }
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
                    }
                });
            }
        });
    }
})

// koniec quizu
app.post('/quiz/:quizId/end', csrfProtection, (req, res) => {
    const now = Number(new Date());
    let taken: number;
    let penalty = 0;
    if (!req.session.zalogowany?.username) {
        res.render('logowanie', {error: ''});
    } else {
        sqlite3.verbose();

        const db = new sqlite3.Database('baza.db');

        db.all(`SELECT paskey FROM hasla WHERE user = '${req.session.zalogowany.username}'`,
            [], (err7, rows7) => {

            if (err7) {
                res.render('error', {
                    message: 'Internal server error',
                    csrfToken: req.csrfToken()
                });
                return;
            }

            if (rows7[0].paskey !== req.session.zalogowany.paskey) {
                res.render('logowanie', {error: 'Hasło zostało zmienione'});
            } else {
                const result = JSON.parse(req.body.result);

                db.all(`SELECT * FROM times WHERE quiz_id = ${req.params.quizId} AND user = '${req.session.zalogowany.username}'`,
                    [], (err3, rows3) => {

                    if(err3) {
                        res.render('error', {
                            message: 'Internal server error',
                            csrfToken: req.csrfToken()
                        });
                        return;
                    }

                    if (rows3[0].stop !== 0) {
                        res.render('error', {
                            message: 'Test already solved',
                            csrfToken: req.csrfToken(),
                            user: req.session.zalogowany.username
                        });
                    } else {
                        taken = (now - rows3[0].start) / 1000;
                        db.all(`SELECT q_id, answer, penalty FROM questions WHERE quiz_id = ${req.params.quizId} ORDER BY q_id`,
                            [], (err2, rows2) => {

                            if (err2 || rows2.length !== result.length) {
                                res.render('error', {
                                    message: 'Internal server error',
                                    csrfToken: req.csrfToken()
                                });
                                return;
                            }

                            const anses:string[] = [];
                            for (let j = 0; j < result.length; j++) {
                                if (result[j].questionID !== rows2[j].q_id) {
                                    res.render('error', {
                                        message: 'Internal server error',
                                        csrfToken: req.csrfToken()
                                    });
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
                            }

                            beginUntilPasses(db, mainTrans);

                            // const tryUntil = () => {
                            //     try {
                            //         seqSql(db,
                            //             ['BEGIN EXCLUSIVE TRANSACTION',
                            //             `UPDATE times SET stop = ${now}`].concat(anses).concat([
                            //                 `INSERT INTO wholeres VALUES('${req.session.zalogowany.username}', ${req.params.quizId}, ${taken + penalty})`,
                            //                 'COMMIT'
                            //             ]), () => {
                            //                 db.close();
                            //                 res.render('poquizie', {
                            //                     csrfToken: req.csrfToken(),
                            //                     id:req.params.quizId,
                            //                     user: req.session.zalogowany.username,
                            //                     result:req.body.result
                            //                 });
                            //             })
                            //     } catch {
                            //         db.run('ROLLBACK', ()=>{tryUntil()});
                            //     }
                            // }

                            // tryUntil();
                        })
                    }
                })
            }
        });
    }
})

// wejście w statystyki
app.get('/stats/:quizId/:username', csrfProtection, (req, res) => {
    if (!req.session.zalogowany?.username) {
        res.render('logowanie', {error: ''});
    } else {
        sqlite3.verbose();

        const db = new sqlite3.Database('baza.db');

        db.all(`SELECT paskey FROM hasla WHERE user = '${req.session.zalogowany.username}'`,
            [], (err7, rows7) => {

            if (err7) {
                res.render('error', {
                    message: 'Internal server error',
                    csrfToken: req.csrfToken()
                });
                return;
            }

            if (rows7[0].paskey !== req.session.zalogowany.paskey) {
                res.render('logowanie', {error: 'Hasło zostało zmienione'});
            } else {
                const top = new Array(0);
                const stats = new Array(0);
                db.all(`SELECT name, backgroundurl FROM quizes WHERE id=${req.params.quizId}`,
                    [], (err8, rows8) => {

                    if (err8) {
                        res.render('error', {
                            message: 'Internal server error',
                            csrfToken: req.csrfToken()
                        });
                        return;
                    }

                    if (rows8.length < 1) {
                        res.render('error', {
                            message: '404 Not Found',
                            csrfToken: req.csrfToken()
                        });
                        return;
                    }

                    db.all(`SELECT user, wholetime FROM wholeres WHERE quiz_id = ${req.params.quizId} ORDER BY wholetime`,
                        [], (err, rows) => {

                        if (err) {
                            res.render('error', {
                                message: 'Internal server error',
                                csrfToken: req.csrfToken()
                            });
                            return;
                        }

                        if (rows.length === 0) {
                            res.render('error', {
                                message: '404 Not Found',
                                csrfToken: req.csrfToken(),
                                user: req.session.zalogowany.username
                            });
                        } else {
                            db.all(`SELECT q_id, ans, time, pen FROM answers WHERE quiz_id = ${req.params.quizId} AND user LIKE '${req.params.username}' ORDER BY q_id`,
                                [], (err2, rows2) => {

                                if (err2) {
                                    res.render('error', {
                                        message: 'Internal server error',
                                        csrfToken: req.csrfToken()
                                    });
                                    return;
                                }

                                if (rows2.length === 0) {
                                    res.render('error', {
                                        message: '404 Not Found',
                                        csrfToken: req.csrfToken()
                                    });
                                    return;
                                }


                                db.all(`SELECT q_id, text, answer FROM questions WHERE quiz_id = ${req.params.quizId} ORDER BY q_id`,
                                        [], (err3, rows3) => {

                                    if (err3 || rows2.length !== rows3.length) {
                                        res.render('error', {
                                            message: 'Internal server error',
                                            csrfToken: req.csrfToken()
                                        });
                                        return;
                                    }

                                    db.all(`SELECT q_id, AVG(time) as time FROM answers WHERE quiz_id = ${req.params.quizId} AND pen=0 GROUP BY q_id ORDER BY q_id`,
                                        [], (err4, rows4) => {

                                        if (err4) {
                                            res.render('error', {
                                                message: 'Internal server error',
                                                csrfToken: req.csrfToken()
                                            });
                                            return;
                                        }

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
                        }
                    })
                })
            }
        });
    }
});

// strony, których nie ma
app.get('/*', csrfProtection, (req, res) => {
    res.render('error', {
        message: '404 Not Found',
        csrfToken: req.csrfToken()
    })
});

module.exports = app;