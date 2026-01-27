#!/bin/sh
APP="$0"
COMMAND=$1
if [ $COMMAND ]; then
	shift
fi
ARGS=$@
COMPOSE="docker compose"


DJANGO="$COMPOSE exec django"
MANAGE="$DJANGO python3 manage.py"

if [ "$COMMAND" = "ps" ]; then
    $COMPOSE ps $ARGS
elif [ "$COMMAND" = "exec" ]; then
    $COMPOSE exec $ARGS
elif [ "$COMMAND" = "update" ]; then
	git pull
    $COMPOSE up -d --build
	$MANAGE migrate
    $MANAGE collectstatic --noinput
    $COMPOSE restart django
elif [ "$COMMAND" = "build" ]; then
    $COMPOSE build $ARGS
elif [ "$COMMAND" = "start" ]; then
    $COMPOSE up -d $ARGS
elif [ "$COMMAND" = "logs" ]; then
    $COMPOSE logs -f --tail="100" $ARGS
elif [ "$COMMAND" = "buildjs" ]; then
    $COMPOSE exec frontend yarn build
elif [ "$COMMAND" = "black" ]; then
    $COMPOSE exec django black --line-length=120 ./
elif [ "$COMMAND" = "stop" ]; then
    $COMPOSE stop $ARGS
elif [ "$COMMAND" = "psql" ]; then
    $COMPOSE exec postgres psql -U postgres
elif [ "$COMMAND" = "req" ]; then
    $COMPOSE exec django pip install -r requirements.txt
elif [ "$COMMAND" = "make_dump" ]; then
    $COMPOSE exec -T postgres pg_dump -c -h localhost -p 5432 -U postgres
elif [ "$COMMAND" = "load_dump" ]; then
    $COMPOSE exec -T postgres psql -U postgres
elif [ "$COMMAND" = "bash" ]; then
    $DJANGO bash $ARGS
elif [ "$COMMAND" = "format" ]; then
    isort ./
    black --line-length=120 ./
elif [ "$COMMAND" = "runserver" ]; then
    $MANAGE runserver 0.0.0.0:8000
elif [ "$COMMAND" = "manage" ]; then
    $MANAGE $ARGS
elif [ "$COMMAND" = "manage.py" ]; then
    $MANAGE $ARGS
else
    $MANAGE $COMMAND $ARGS
fi

exit
