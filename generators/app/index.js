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
const convert = require('xml-js');
var json2xls = require('json2xls');

module.exports = class extends Generator {
  prompting() {
    // Have Yeoman greet the user.
    this.log(
      yosay(`Welcome to the phenomenal ${chalk.red('generator-mq')} generator!`)
    );

    const prompts = [
      {
        name: 'mode',
        type: 'list',
        message: 'What do you want to do?',
        choices: [
          'Calculate Complexity for MQ Migration',
          'Replace Patterns in Files',
          'Generate PCF Migration Report',
        ],
      },
      {
        name: 'fileType',
        type: 'list',
        message: 'What is the language used in your project?',
        choices: ['Java', 'C/C++', 'Yaml'],
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
        },
      },
    ];

    return this.prompt(prompts).then((props) => {
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
      const actualPatterns =
        this.props.fileType === 'Java' ? patterns : cPatterns;
      var overview = {
        complexity: '',
        'Time Needed for Migration': '',
        complexityValue: 0,
        details: {},
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
              details: [],
            };
          }

          overview.details[result].details.push({
            matches: res.matches[0],
            count: res.count,
            complexity: actualPatterns[i].complexity,
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
        overview.details[file].fileComplexity /=
          overview.details[file].totalOccurences;
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
      const actualPatterns =
        this.props.fileType === 'Java' ? patterns : cPatterns;

      for (var i = 0; i < actualPatterns.length; i++) {
        var options = {
          files: this.props.classFilePath + '*' + fileType,
          from: new RegExp(actualPatterns[i].pattern, 'g'),
          to: actualPatterns[i].replaceWith,
        };

        var replacements = await replace(options);
        console.log(replacements);
      }
    } else if (this.props.mode === 'Generate PCF Migration Report') {
      let infos = [];
      let files = await getFiles(this.props.classFilePath);
      // Console.log('++++++++++++++++++++++++++++++', files);

      // Manifest.yml
      // Windows
      const MANIFEST = '\\manifest.yml';

      // MacOS
      // const MANIFEST = 'manigest.yml'
      let neededFiles = files.filter(function(str) {
        return str.indexOf(MANIFEST) > -1;
      });

      let ENVIRONMENTS = ['dev', 'qa', 'uat', 'prod', 'dr'];

      // Console.log('++++++++++++++++++++++++++++++', neededFiles);
      neededFiles.forEach(function(item) {
        let jsonObject = null;
        try {
          jsonObject = yaml.load(fs.readFileSync(item, { encoding: 'utf-8' }));
        } catch (e) {
          console.log(file, e);
        }

        let applications = jsonObject && jsonObject.applications;
        let appName = null;
        let services = [];
        let instances = {};
        let stacks = {};
        let buildpacks = {};

        if (applications) {
          const filteredApp = applications.filter(function(application) {
            return application.name.indexOf('-' + ENVIRONMENTS[0] + '-') > -1;
          });

          if (filteredApp && filteredApp[0] && filteredApp[0].name) {
            appName = filteredApp[0].name.split('-' + ENVIRONMENTS[0] + '-')[0];
          }

          if (!appName) {
            appName;
          }

          services = applications[0].services ? applications[0].services : [];

          applications.forEach(function(application) {
            for (let i = 0; i < ENVIRONMENTS.length; i++) {
              if (application.name.indexOf('-' + ENVIRONMENTS[i] + '-') > -1) {
                instances[ENVIRONMENTS[i]] = application.instances;

                if (application.stack) {
                  stacks[ENVIRONMENTS[i]] = application.stack;
                }

                if (application.buildpack || application.buildpacks) {
                  buildpacks[ENVIRONMENTS[i]] = application.buildpack
                    ? application.buildpack
                    : application.buildpacks.toString();
                }

                break;
              }
            }
          });
        }

        // Autoscaler-manifest
        let appPath = item.split(MANIFEST)[0];
        // Windows
        let autoFilePath = appPath + '\\autoscaler-manifest.yml';
        // MacOS
        // let autoFilePath = appPath + 'autoscaler-manifest.yml';
        let autoscaling = 'N/A';

        try {
          let autoJson = yaml.load(
            fs.readFileSync(autoFilePath, { encoding: 'utf-8' })
          );

          let instanceLimits = autoJson.instance_limits;

          autoscaling =
            'Min: ' + instanceLimits.min + ' Max: ' + instanceLimits.max;
        } catch (e) {
          console.log('No autoscaler present.');
        }

        // Jenkinsfile
        // Windows
        let jenkinsFilePath = appPath + '\\Jenkinsfile';
        // MacOS
        // let jenkinsFilePath = appPath + 'Jenkinsfile';
        let libraries = [];

        try {
          if (fs.existsSync(jenkinsFilePath)) {
            let jenkinsFileText = fs.readFileSync(jenkinsFilePath, {
              encoding: 'utf-8',
            });

            const regexp = /^@Library/g;

            let match;
            while ((match = regexp.exec(jenkinsFileText)) !== null) {
              libraries.push(jenkinsFileText.split(/\r?\n/)[match.index]);
            }
          }
        } catch (e) {
          console.log('No Jenkinsfile present.');
        }

        // Pom.xml
        // Windows
        let pomFilePath = appPath + '\\pom.xml';
        // MacOS
        // let pomFilePath = appPath + 'pom.xml';
        let javaPlugins = [];
        let javaDependencies = [];

        try {
          if (fs.existsSync(pomFilePath)) {
            let pomFileText = fs.readFileSync(pomFilePath, {
              encoding: 'utf-8',
            });

            let pomFileObject = convert.xml2js(pomFileText, {
              compact: true,
              spaces: 4,
            });

            let allPlugins = JSON.stringify(
              pomFileObject.project.build.plugins
            );

            if (allPlugins.includes('java-cfenv-boot' || 'io.pivotal.cfenv')) {
              javaPlugins.push('java-cfenv-boot');
            }

            if (allPlugins.includes('spring-cloud-cloudfoundry')) {
              javaPlugins.push('spring-cloud-cloudfoundry');
            }

            if (allPlugins.includes('cloudfoundry' || 'cloud foundry')) {
              javaPlugins.push('cloud foundry dependency');
            }

            let allDependencies = JSON.stringify(
              pomFileObject.project.dependencies.dependency
            );

            if (
              allDependencies.includes('java-cfenv-boot' || 'io.pivotal.cfenv')
            ) {
              javaPlugins.push('java-cfenv-boot');
            }

            if (allDependencies.includes('spring-cloud-cloudfoundry')) {
              javaPlugins.push('spring-cloud-cloudfoundry');
            }

            if (allDependencies.includes('cloudfoundry' || 'cloud foundry')) {
              javaPlugins.push('cloud foundry dependency');
            }
          }
        } catch (e) {
          console.log('No pom file present.');
        }

        // Package.json
        // Windows
        let packageFilePath = appPath + '\\package.json';
        // MacOS
        // let packageFilePath = appPath + 'package.json';
        let nginxDependencies = [];
        let nginxDevDependencies = [];

        try {
          if (fs.existsSync(packageFilePath)) {
            let packageFileContents = fs.readFileSync(packageFilePath, {
              encoding: 'utf-8',
            });

            let packageFileObject = JSON.parse(packageFileContents);
            let allNginxDependencies = JSON.stringify(
              packageFileObject.dependencies
            );
            if (allNginxDependencies.includes('cloudfoundry'))
              nginxDependencies.push('cloudfoundry');

            let allNginxDevDependencies = JSON.stringify(
              packageFileObject.devDependencies
            );
            if (allNginxDevDependencies.includes('cloudfoundry'))
              nginxDevDependencies.push('cloudfoundry');
          }
        } catch (e) {
          console.log('No package.json present.');
        }

        // Calculate complexity based on prod instances
        let complexity;
        if (!instances.prod || instances.prod < 2) {
          complexity = 'Low';
        } else if (instances.prod >= 2 && instances.prod <= 4) {
          complexity = 'Medium';
        } else if (instances.prod > 4) {
          complexity = 'High';
        }

        // Windows
        let repoNameArray = appPath.split('\\');
        // MacOS
        // let repoNameArray = appPath.split('/');
        let repoName = repoNameArray[repoNameArray.length - 1];

        let info = {
          RepoName: repoName,
          AppName: appName ? appName : appPath,
          Services: services ? services[0] : 'No services found.',
          Autoscaling: autoscaling,
          'Default Instances': instances,
          Complexity: complexity,
          Comments: '',
          Stacks: stacks,
          Buildpacks: buildpacks,
          'Jenkinsfile Shared Libraries': libraries[0] ? libraries[0] : '',
          'Java CF Plugins': javaPlugins[0] ? javaPlugins[0] : '',
          'Java CF Dependencies': javaDependencies[0]
            ? javaDependencies[0]
            : '',
          'NGINX CF Dependencies': nginxDependencies[0]
            ? nginxDependencies[0]
            : '',
          'NGINX CF DevDependencies': nginxDevDependencies[0]
            ? nginxDependencies[0]
            : '',
        };

        infos.push(info);

        let j = Math.max(
          services.length,
          javaPlugins.length,
          javaDependencies.length,
          nginxDependencies.length,
          nginxDevDependencies.length
        );
        if (j && j > 1) {
          for (i = 1; i < j; i++) {
            infos.push({
              RepoName: '',
              AppName: '',
              Services: services[i] ? services[i] : '',
              Autoscaling: '',
              'Default Instances': '',
              Complexity: '',
              Comments: '',
              Stacks: '',
              Buildpacks: '',
              'Jenkinsfile Shared Libraries': libraries[i] ? libraries[i] : '',
              'Java CF Plugins': javaPlugins[i] ? javaPlugins[i] : '',
              'Java CF Dependencies': javaDependencies[i]
                ? javaDependencies[i]
                : '',
              'NGINX CF Dependencies': nginxDependencies[i]
                ? nginxDependencies[i]
                : '',
              'NGINX CF DevDependencies': nginxDevDependencies[i]
                ? nginxDependencies[i]
                : '',
            });
          }
        }
      });

      convertToExcel(infos);
      let jsonString = JSON.stringify(infos);
      fs.writeFile('pcf-report.json', jsonString, function(result, error) {
        if (error) console.log('ERROR: ', error);
      });
      console.log('infos: ', infos);
    }
  }
};

function findInFilesSync(pattern, directoryPath, fileExtension) {
  return new Promise((resolve) => {
    findInFiles
      .find(pattern, directoryPath, fileExtension)
      .then(function(results) {
        resolve(results);
      });
  });
}

async function getFiles(dir) {
  const dirents = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    dirents.map((dirent) => {
      const res = resolve(dir, dirent.name);
      return dirent.isDirectory() ? getFiles(res) : res;
    })
  );
  return Array.prototype.concat(...files);
}

var convertToExcel = function(report) {
  var xls = json2xls(report);
  const filename = 'pcf-report.xlsx';
  fs.writeFileSync(filename, xls, 'binary', (err) => {
    if (err) {
      console.log('writeFileSync :', err);
    }
    console.log(filename + ' file is saved!');
  });
};
