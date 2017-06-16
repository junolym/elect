#!/usr/bin/env node
'use strict';
const list = require('./list.json')['aaData'];

for (let i in list) {
    if (JSON.stringify(list[i]).match(process.argv[2])) {
        let info = {};
        info['jx02id'] = list[i]['jx02id'];
        info['jx0404id'] = list[i]['jx0404id'];
        info['sksj'] = list[i]['sksj'];
        info['skls'] = list[i]['skls'];
        info['kcmc'] = list[i]['kcmc'];
        console.log(info);
    }
}
