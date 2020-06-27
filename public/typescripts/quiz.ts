// pobieram treść quizu
const quiz = JSON.parse(document.querySelector('p[id="JSON"]').innerHTML);
const quizno = JSON.parse(document.querySelector('p[id="quizno"]').innerHTML);

let counter = quiz.length;

//  Dopóki w tablicy coś jest
while (counter > 0) {
    // Biorę losowy indeks
    const index = Math.floor(Math.random() * counter);

    // Obniżam licznik o 1
    counter--;

    // Zamieniam z nim ostatni element
    const temp = quiz[counter];
    quiz[counter] = quiz[index];
    quiz[index] = temp;
}

/*** SELEKTORY ***/
const answer = document.querySelector('#answer') as HTMLInputElement;
const back = document.getElementById("back") as HTMLButtonElement;
const description = document.getElementById("description") as HTMLDivElement;
const forward = document.getElementById("forward") as HTMLButtonElement;
const game = document.getElementById("game") as HTMLDivElement;
const gameheader = document.getElementById("gamehead") as HTMLParagraphElement;
const image = document.getElementById('image') as HTMLImageElement;
const nick = document.getElementById('nick') as HTMLInputElement;
const panel = document.querySelector('#panel') as HTMLDivElement;
const penaltytext = document.getElementById("penaltytext") as HTMLParagraphElement;
const questiontext = document.getElementById("questiontext") as HTMLParagraphElement;
const replies = document.getElementById("replies") as HTMLTableElement;
const stopbutton = document.querySelector('#stop') as HTMLInputElement;
const timer = document.getElementById("timer") as HTMLParagraphElement;

let answers = [] as string[]; // tablica, do której zbieramy odpowiedzi użytkownika
let times = [] as number[]; // tablica, do której zbieramy spędzony czas
let currentQuestion = 0; // miejsce aktualnego pyt. w tablicy (po potasowaniu)
let isFirst = true;
let lastLoad = Number(new Date());
// ładowanie strony pytania (tryb gry)
function loadPage(pageNo:number) {
    if (isFirst === true) {
        isFirst = false;
    } else {
        const newLoad = Number(new Date());
        times[currentQuestion] += newLoad - lastLoad;
        time += newLoad - lastLoad;
        lastLoad = newLoad;
    }

    currentQuestion = pageNo;

    // aktualizacja informacji dot. pytania
    gameheader.innerHTML = `Pytanie nr ${pageNo + 1}`;
    questiontext.innerHTML = quiz[pageNo].text;
    penaltytext.innerHTML = `Błąd: +${quiz[pageNo].penalty} sekund`;
    image.setAttribute('src', `${quiz[pageNo].image}`);
    answer.value = answers[pageNo];

    // włączenie/wyłączenie odpowiednich przyciskóœ nawigacyjnych
    if (pageNo === 0) back.setAttribute('disabled', 'disabled');
    else back.removeAttribute('disabled');
    if (pageNo === quiz.length - 1) forward.setAttribute('disabled', 'disabled');
    else forward.removeAttribute('disabled');

    // chcemy, by po załadowaniu od razu można było wpisywać
    answer.focus();
}

// wstecz
function clickBack() {
    loadPage(currentQuestion - 1);
}


// dalej
function clickForward() {
    loadPage(currentQuestion + 1);
}

back.addEventListener('click', () => {
    clickBack();
})

forward.addEventListener('click', () => {
    clickForward();
})

// gra zaczyna być widoczna, powitanie przestaje
game.style.display = '';

// ustawienie początkowe przycisku i tytułu
stopbutton.setAttribute('disabled', 'disabled');
document.title = `${quiz.length} pytań do końca`

// ustawienie licznika, zmiennej przerwania, tablicy statystyk,
let time = 0.0;
const gamelog: { questionID: any; answer: string; time: number; }[] = [];

for (let i=0; i !== quiz.length; i++) {
    answers.push("");
    times.push(0);

    // dodanie do panelu przycisków pytań
    panel.innerHTML += `<div class='questionbutton' data-id='${i}'
            onclick=loadPage(${i})><p>${i + 1}</p></div>\n`;
}

// spanie asynchroniczne (oczekiwanie odp. czasu)
const sleep = (milliseconds:number) => {
    return new Promise(resolve => setTimeout(resolve, milliseconds))
}

// liczy, ile pytań zostało
function left() {
    let j = 0;

    for (let i = 0; i !== answers.length; i++) {
        const button = document.querySelector(
            `.questionbutton[data-id='${i}']`
            ) as HTMLDivElement;

        // przy okazji ustawia odpowiednie kolory w panelu
        if (answers[i].length < 1) {
            j++;
            button.style.backgroundColor = '#cccccc';
        } else {
            button.style.backgroundColor = 'orange';
        }
    }

    return j;
}

// zapisuje odpowiedź do tabeli statystyk
function saveAns() {
    answers[currentQuestion] = answer.value;

    // przy okazji odpalam left
    if (left() === 0) {
        document.title = 'Możesz zatrzymać quiz'
        stopbutton.removeAttribute('disabled');
    }

    else {
        document.title = `${left()} pytań do końca`
        stopbutton.setAttribute('disabled', 'disabled');
    }
}

loadPage(0); // ładuję pierwsze pytanie

// reaguję na kilknięcia i zmiany funkcją zapisującą
answer.addEventListener('input', saveAns);

let onlyOneStop = true;
// koniec gry
stopbutton.addEventListener('click', async () => {
    if (onlyOneStop === true) {
        onlyOneStop = false;
    } else {
        return;
    }
    if (isFirst === true) {
        isFirst = false;
    } else {
        const newLoad = Number(new Date());
        times[currentQuestion] += newLoad - lastLoad;
        time += newLoad - lastLoad;
        lastLoad = newLoad;
    }

    // uzupełnienie statystyk
    for (let k = 0; k < answers.length; k++) {
        gamelog.push(
            {
                questionID: quiz[k].id,
                answer: answers[k],
                time: times[k] / time
            }
        );
        gamelog.sort((a,b)=> {return a.questionID - b.questionID})
    }

    const url = `http://localhost:3000/quiz/${quizno}/end`;
    // await fetch(url, {
    //     method: "POST",
    //     headers: {
    //         "Content-Type":"application/json",
    //         "csrf-token": document.querySelector("#csrf").innerHTML
    //     },
    //     body: JSON.stringify(gamelog)
    // });

    const Http = new XMLHttpRequest();
    Http.open("POST", url, false);
    Http.setRequestHeader("Content-Type", "application/json");
    Http.setRequestHeader("csrf-token", document.querySelector("#csrf").innerHTML);
    Http.send(JSON.stringify(gamelog));

    document.write(Http.response)
});