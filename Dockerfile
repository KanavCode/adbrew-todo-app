# set base image (host OS)
# Pinned to bullseye: the floating `python:3.8` tag now resolves to bookworm, which has no
# libssl1.1 (needed by MongoDB 4.4) and ships a Node version too new for react-scripts 4.
FROM python:3.8-bullseye

RUN rm /bin/sh && ln -s /bin/bash /bin/sh

# Debian 11 is end-of-life: its security repo is gone from deb.debian.org, so point apt at the
# archive (whose Release files are expired, hence Check-Valid-Until=false).
RUN sed -i 's|deb.debian.org|archive.debian.org|g' /etc/apt/sources.list \
    && echo 'Acquire::Check-Valid-Until "false";' > /etc/apt/apt.conf.d/99archive

RUN apt-get -y update
RUN apt-get install -y curl nano wget nginx git

RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list


# Mongo
RUN ln -s /bin/echo /bin/systemctl
RUN wget -qO - https://www.mongodb.org/static/pgp/server-4.4.asc | apt-key add -
RUN echo "deb http://repo.mongodb.org/apt/debian buster/mongodb-org/4.4 main" | tee /etc/apt/sources.list.d/mongodb-org-4.4.list
RUN apt-get -y update
RUN apt-get install -y mongodb-org

# Install Yarn
RUN apt-get install -y yarn

# PIP is already bundled with the official python image; recent setuptools no longer ships
# `easy_install`, so the old `easy_install pip` step fails. Just verify pip is available.
RUN pip --version


ENV ENV_TYPE staging
ENV MONGO_HOST mongo
ENV MONGO_PORT 27017
##########

ENV PYTHONPATH=$PYTHONPATH:/src/

# copy the dependencies file to the working directory
COPY src/requirements.txt .

# install dependencies
RUN pip install -r requirements.txt
