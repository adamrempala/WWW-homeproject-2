#!/bin/bash

tokil=0 # tu będziemy przechowywać numer procesu do zabicia

on_kill() { # gdy zabijamy proces
    if [[ $tokil != 0 ]] ; then #
        kill $tokil
    fi
    exit 1
}

server() {
    export tokil=$! #zapisujemy numer procesu
    npm start
}

trap 'on_kill' SIGINT # powyższa funkcja uruchamiana w przypadku SIGINT-a

server &

#

while ! (netstat -na | grep -Eq ":3000 .*LISTEN" 2>/dev/null ) ; do 
    :
done

npx ts-node creator
npx mocha -timeout 600000 -r  ts-node/register test.ts

kill $tokil
exit 0