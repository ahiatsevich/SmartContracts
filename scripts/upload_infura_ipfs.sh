#!/bin/bash

for i in $(ls  ./downloaded); do
    echo $i
    content="curl -F \"image=@./downloaded/$i\" https://ipfs.infura.io:5001/api/v0/add"
    eval $content >> output.txt
done