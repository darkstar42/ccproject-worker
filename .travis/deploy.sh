#!/bin/bash

if [[ $TRAVIS_BRANCH == 'production' ]]; then
    rm -Rf /tmp/deploy
    mkdir -p /tmp/deploy/opt/ccproject-worker
    cp -pR ./* /tmp/deploy/opt/ccproject-worker
    mkdir -p /tmp/deploy/opt/etc/init.d/
    cp .travis/ccproject-worker /tmp/deploy/opt/etc/init.d/ccproject-worker
    chmod +x /tmp/deploy/opt/etc/init.d/ccproject-worker
    rm -f *.deb
    fpm -s dir -t deb -C /tmp/deploy --name ccproject-worker --version 0.0.1 --iteration build-$TRAVIS_BUILD_NUMBER .

    scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null *.deb deployment@puppet.cc.gernox.de:/tmp/
fi
