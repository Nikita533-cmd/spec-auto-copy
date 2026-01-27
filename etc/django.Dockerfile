FROM python:3.11
ENV PYTHONUNBUFFERED 1 

RUN mkdir -p /webapp 
RUN mkdir -p /webapp/static 

WORKDIR /webapp

COPY ./requirements.txt /webapp/requirements.txt

RUN pip install -r requirements.txt --src /usr/local/src

