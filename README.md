# generator-mq [![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Dependency Status][daviddm-image]][daviddm-url]
> Checking the complexity of migrating from IBM MQ to AWS MQ

## Installation

First, install [Yeoman](http://yeoman.io) and generator-mq using [npm](https://www.npmjs.com/) (we assume you have pre-installed [node.js](https://nodejs.org/)).

```bash
npm install -g yo
npm install -g generator-mq
```

## Configuration
Reconfigure the pattern and its approximate complexity to migrate to AWS MQ in the 
```bash
./generators/app/templates/patterns.json
```

## Run
Then check the complexity to migrate your project:

```bash
yo mq
```
And follow the instructions of the generator.
At the end, you will find a Summary.json file in the root of your project to explain the complexity of migration.

## Getting To Know Yeoman

 * Yeoman has a heart of gold.
 * Yeoman is a person with feelings and opinions, but is very easy to work with.
 * Yeoman can be too opinionated at times but is easily convinced not to be.
 * Feel free to [learn more about Yeoman](http://yeoman.io/).

## License

MIT © [Cedrus Digital](www.example.com)


[npm-image]: https://badge.fury.io/js/generator-mq.svg
[npm-url]: https://npmjs.org/package/generator-mq
[travis-image]: https://travis-ci.org/SaeidEid/generator-mq.svg?branch=master
[travis-url]: https://travis-ci.org/SaeidEid/generator-mq
[daviddm-image]: https://david-dm.org/SaeidEid/generator-mq.svg?theme=shields.io
[daviddm-url]: https://david-dm.org/SaeidEid/generator-mq
