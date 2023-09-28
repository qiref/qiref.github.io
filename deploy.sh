#!/bin/bash

CURRENT_DIR=$(
    cd $(dirname $0)
    pwd
)

while getopts "m:p" arg; do #选项后面的冒号表示该选项需要参数
    case $arg in
    m)
        # echo "m's arg:$OPTARG" #参数存在$OPTARG中
        COMMIT_MSG="$OPTARG"
        ;;
    p)
        # echo "-p"
        PUSH=1
        ;;
    ?) #当有不认识的选项的时候arg为?
        echo "unkonw argument"
        exit 1
        ;;
    esac
done

echo "--------------------------------------------------"
echo "-m $COMMIT_MSG"
echo "-p $PUSH"
echo "--------------------------------------------------"

echo deploy start
echo "current dir is :" $CURRENT_DIR
$(cd $CURRENT_DIR)
hugo -d docs
# git status
git add .
git commit -m "[blog] $COMMIT_MSG"
# git status

if [[ $PUSH -eq 1 ]]
 then
    echo "push to origin master"
    git remote -v
    git push origin master
fi

