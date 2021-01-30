'use strict';
const Generator = require('yeoman-generator');
const chalk = require('chalk');
const yosay = require('yosay');
var findInFiles = require('find-in-files');
const replace = require('replace-in-file');
const fs = require('fs');
const yaml = require('js-yaml');
const { resolve } = require('path');
const { readdir } = require('fs').promises;

module.exports = class extends Generator {
  prompting() {
    // Have Yeoman greet the user.
    this.log(yosay(`Welcome to the phenomenal ${chalk.red('generator-mq')} generator!`));

    const prompts = [
      {
        name: 'mode',
        type: 'list',
        message: 'What do you want to do?',
        choices: [
          'Calculate Complexity for MQ Migration',
          'Replace Patterns in Files',
          'Generate PCF Migration Report'
        ]
      },
      {
        name: 'fileType',
        type: 'list',
        message: 'What is the language used in your project?',
        choices: ['Java', 'C/C++', 'Yaml']
      },
      {
        type: 'input',
        name: 'classFilePath',
        message: 'Enter the path of the directory containing files:',
        validate: function(input) {
          if (input.length === 0) {
            return 'You forgot to enter your files location!';
          }
          var done = this.async();
          done(null, true);
        }
      }
    ];

    return this.prompt(prompts).then(props => {
      // To access props later use this.props.someAnswer;
      this.props = props;
    });
  }

  async writing() {
    var fileType = '.java';
    if (this.props.fileType === 'C/C++') {
      fileType = '.c';
    } else if (this.props.fileType === 'Yaml') {
      fileType = '.yml';
    }
    if (this.props.mode === 'Calculate Complexity for MQ Migration') {
      const patterns = require('./templates/patterns.json');
      const cPatterns = require('./templates/c-patterns.json');
      const actualPatterns = this.props.fileType == 'Java' ? patterns : cPatterns;
      var overview = {
        complexity: '',
        'Time Needed for Migration': '',
        complexityValue: 0,
        details: {}
      };
      for (let i = 0; i < actualPatterns.length; i++) {
        var results = await findInFilesSync(
          actualPatterns[i].pattern,
          this.props.classFilePath,
          fileType + '$'
        );
        for (var result in results) {
          var res = results[result];
          if (!overview.details[result]) {
            overview.details[result] = {
              fileComplexity: 0,
              totalOccurences: 0,
              details: []
            };
          }
          overview.details[result].details.push({
            matches: res.matches[0],
            count: res.count,
            complexity: actualPatterns[i].complexity
          });
          overview.details[result].fileComplexity +=
            res.count * actualPatterns[i].complexity;
          overview.details[result].totalOccurences += res.count;
        }
      }
      var totalComplexity = 0;
      var totalFiles = 0;
      for (var file in overview.details) {
        console.log('File: ', file);
        if (overview.details[file].totalOccurences === 0) {
          overview.details[file].totalOccurences = 1;
        }
        overview.details[file].fileComplexity /= overview.details[file].totalOccurences;
        delete overview.details[file].totalOccurences;
        totalComplexity += overview.details[file].fileComplexity;
        totalFiles++;
      }
      if (totalFiles === 0) {
        totalFiles = 1;
      }
      overview.complexityValue = totalComplexity / totalFiles;
      if (overview.complexityValue < 3) {
        overview.complexity = 'Simple';
        overview['Time Needed for Migration'] = '2 Days';
      } else if (overview.complexityValue > 3 && overview.complexityValue < 4) {
        overview.complexity = 'Meduim';
        overview['Time Needed for Migration'] = '3 Days';
      } else if (overview.complexityValue > 4 && overview.complexityValue < 5) {
        overview.complexity = 'Complex';
        overview['Time Needed for Migration'] = '4 Days';
      } else if (overview.complexityValue > 5) {
        overview.complexity = 'Very Complex';
        overview['Time Needed for Migration'] = '5 Days';
      }
      fs.writeFileSync('./summary.json', JSON.stringify(overview));
    } else if (this.props.mode === 'Replace Patterns in Files') {
      const patterns = require('./templates/replace-patterns.json');
      const cPatterns = require('./templates/replace-c-patterns.json');
      const actualPatterns = this.props.fileType === 'Java' ? patterns : cPatterns;
      for (var i = 0; i < actualPatterns.length; i++) {
        var options = {
          files: this.props.classFilePath + '*' + fileType,
          from: new RegExp(actualPatterns[i].pattern, 'g'),
          to: actualPatterns[i].replaceWith
        };
        var replacements = await replace(options);
        console.log(replacements);
      }
    } else if (this.props.mode === 'Generate PCF Migration Report') {
      let infos = [];
      let files = await getFiles(this.props.classFilePath);
      const MANIFEST = '/manifest.yml';
      let neededFiles = files.filter(function(str) {
        return str.indexOf(MANIFEST) > -1;
      });
      let ENVIRONMENTS = ['dev', 'qa', 'uat', 'prod', 'dr'];
      neededFiles.forEach(function(item) {
        let jsonObject = yaml.load(fs.readFileSync(item, { encoding: 'utf-8' }));
        let applications = jsonObject.applications;
        let appName = applications
          .filter(function(application) {
            return application.name.indexOf('-' + ENVIRONMENTS[0] + '-') > -1;
          })[0]
          .name.split('-' + ENVIRONMENTS[0] + '-')[0];
        let services = applications[0].services;
        let instances = {};
        applications.forEach(function(application) {
          for (let i = 0; i < ENVIRONMENTS.length; i++) {
            if (application.name.indexOf('-' + ENVIRONMENTS[i] + '-') > -1) {
              instances[ENVIRONMENTS[i]] = application.instances;
              break;
            }
          }
        });

        let appPath = item.split(MANIFEST)[0];
        let autoFilePath = appPath + '/autoscaler-manifest.yml';
        let autoscaling = 'N/A';
        try {
          let autoJson = yaml.load(fs.readFileSync(autoFilePath, { encoding: 'utf-8' }));
          let instance_limits = autoJson.instance_limits;
          autoscaling = 'Min: ' + instance_limits.min + ' Max: ' + instance_limits.max;
        } catch (e) {
          console.log('No autoscaler');
        }
        let info = {
          AppName: appName,
          Services: services,
          Autoscaling: autoscaling,
          'Default Instances': instances,
          Complexity: 'Medium',
          Comments: ''
        };
        infos.push(info);
      });

      console.log('infos: ', infos);
    }
  }
};

function findInFilesSync(pattern, directoryPath, fileExtension) {
  return new Promise(resolve => {
    findInFiles.find(pattern, directoryPath, fileExtension).then(function(results) {
      resolve(results);
    });
  });
}

async function getFiles(dir) {
  const dirents = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    dirents.map(dirent => {
      const res = resolve(dir, dirent.name);
      return dirent.isDirectory() ? getFiles(res) : res;
    })
  );
  return Array.prototype.concat(...files);
}
