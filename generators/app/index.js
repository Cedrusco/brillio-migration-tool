'use strict';
const Generator = require('yeoman-generator');
const chalk = require('chalk');
const yosay = require('yosay');
var findInFiles = require('find-in-files');
const replace = require('replace-in-file');
const fs = require('fs');

module.exports = class extends Generator {
  prompting() {
    // Have Yeoman greet the user.
    this.log(yosay(`Welcome to the phenomenal ${chalk.red('generator-mq')} generator!`));

    const prompts = [
      {
        name: 'mode',
        type: 'list',
        message: 'Do you want to calculate the complexity or replace the patterns?',
        choices: ['Calculate Complexity', 'Replace Patterns']
      },
      {
        name: 'fileType',
        type: 'list',
        message: 'What is the language used in your project?',
        choices: ['Java', 'C/C++']
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
    if (this.props.fileType == 'C/C++') {
      fileType = '.c';
    }
    if (this.props.mode === 'Calculate Complexity') {
      const patterns = require('./templates/patterns.json');
      const c_patterns = require('./templates/c-patterns.json');
      const actualPatterns = this.props.fileType == 'Java' ? patterns : c_patterns;
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
    } else if (this.props.mode === 'Replace Patterns') {
      const patterns = require('./templates/replace-patterns.json');
      const c_patterns = require('./templates/replace-c-patterns.json');
      const actualPatterns = this.props.fileType == 'Java' ? patterns : c_patterns;
      for (var i = 0; i < actualPatterns.length; i++) {
        var options = {
          files: this.props.classFilePath + '*' + fileType,
          from: new RegExp(actualPatterns[i].pattern, 'g'),
          to: actualPatterns[i].replaceWith
        };
        var replacements = await replace(options);
        console.log(replacements);
      }
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
