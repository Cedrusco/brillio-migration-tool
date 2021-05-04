# generator-cmt [![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Dependency Status][daviddm-image]][daviddm-url]
> Generate reports on various migration types

# Cedrus Migration Tool

## Installation

First, install [Yeoman](http://yeoman.io) and generator-mq using [npm](https://www.npmjs.com/) (we assume you have pre-installed [node.js](https://nodejs.org/)).

```bash
npm install -g yo
npm install -g generator-cmt
```

## Configuration 
For mq migrations, reconfigure the pattern and its approximate complexity to migrate to AWS MQ in the 
```bash
./generators/app/templates/patterns.json
```

## Run
Check the complexity to migrate your project:

```bash
yo cmt
```
And follow the instructions of the generator.

## Results
### MQ Migration
You will find a Summary.json file in the root of your project to explain the complexity of migration.

### PCF Migration
You will find a pcf-report.json and pcf-report.xlsx in the root directory of you project or in the path you ran the tool.

## Getting To Know Yeoman

 * Yeoman has a heart of gold.
 * Yeoman is a person with feelings and opinions, but is very easy to work with.
 * Yeoman can be too opinionated at times but is easily convinced not to be.
 * Feel free to [learn more about Yeoman](http://yeoman.io/).

## License

Copyright 2018 Cedrus Digital

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.


[npm-image]: https://badge.fury.io/js/generator-cmt.svg
[npm-url]: https://www.npmjs.com/package/generator-cmt
[travis-image]: https://travis-ci.org/Cedrusco/mq-migration-tool.svg?branch=master
[travis-url]: https://travis-ci.org/Cedrusco/mq-migration-tool
[daviddm-image]: https://david-dm.org/Cedrusco/mq-migration-tool.svg?theme=shields.io
[daviddm-url]: https://david-dm.org/Cedrusco/mq-migration-tool
