const readline = require('readline');
const axios = require('axios');
const xl = require('excel4node');
const fs = require('fs');
const json2xls = require('json2xls');

let CF_ENDPOINT;
let CF_AUTH_TOKEN;
let CF_ORG_ID;
let CF_ORG_NAME;

const buildPacks = [];
let letBuildPackCount = 0;
const buildPackToAppMap = {};
let apps = [];
let appCount = 0;
let appServices = [];
const appServiceMap = {};
const appInfo = [];

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('***************Please make sure you have CF cli installed***************');
console.log(
    '---------------and have gathered auth token using cf oauth-token---------------'
);

rl.question('Enter your PCF foundation url ? ', apiEndpoint => {
    rl.question('Enter your authToken gathered using cf oauth-token?', authToken => {
        rl.question('Enter your org guid?', orgId => {
            CF_ENDPOINT = apiEndpoint;
            CF_AUTH_TOKEN = authToken.startsWith('bearer')
                ? authToken
                : `bearer ${authToken}`;
            CF_ORG_ID = orgId;
            rl.close();
        });
    });
});
rl.on('close', () => {
    // GetBuildPacks({
    //     success: () => {
    //         getAppInfo()
    //     }
    // })

    if (CF_ENDPOINT && CF_AUTH_TOKEN) {
        getBuildPacks({
            success: () => {
                getAppInfo();
            }
        });
    } else {
        console.log('Missing apiEndpoint or authToken');
        process.exit(0);
    }
});

const getBuildPacks = ({ success }) => {
    axios({
        method: 'get',
        url: `${CF_ENDPOINT}/v3/buildpacks`,
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: CF_AUTH_TOKEN
        }
    })
        .then(response => {
            letBuildPackCount = response.data.pagination.total_results;
            response.data.resources.forEach(resource => {
                buildPacks.push({
                    name: resource.name,
                    id: resource.guid,
                    stack: resource.stack
                });

                buildPackToAppMap[resource.name] = [];
            });

            success();
        })
        .catch(error => {
            console.error('error getting build packs', error);
        });
};

// const getAppInfo = () => {
//     const url = CF_ORG_ID ? `${CF_ENDPOINT}/v3/apps` : `${CF_ENDPOINT}/v3/apps?organization_guids=${CF_ORG_ID}`
//     axios({
//         method: 'get',
//         url,
//         headers: {
//             'Content-Type': 'application/json',
//             Accept: 'application/json',
//             Authorization: CF_AUTH_TOKEN
//         }
//     })
//         .then(response => {
//             appCount = response.data.pagination.total_results;
//             response.data.resources.forEach(resource => {
//                 apps.push({
//                     name: resource.name,
//                     id: resource.guid
//                 });

//                 resource.lifecycle.data.buildpacks.forEach(buildPack => {
//                     if (buildPackToAppMap[buildPack]) {
//                         buildPackToAppMap[buildPack].push(resource.name);
//                     } else {
//                         buildPackToAppMap[buildPack] = [resource.name];
//                     }
//                 });
//             });
//             getEnvForApps();
//         })
//         .catch(error => {
//             console.error('error getting apps', error);
//         });
// };

const getAppInfo = async () => {
  let page = 1;
  let allApps = [];

  while (true) {
    const url = CF_ORG_ID !== ''
      ? `${CF_ENDPOINT}/v3/apps?page=${page}`
      : `${CF_ENDPOINT}/v3/apps?organization_guids=${CF_ORG_ID}&page=${page}`;

    try {
      const response = await axios({
        method: 'get',
        url,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: CF_AUTH_TOKEN
        }
      });

      const apps = response.data.resources.map(resource => ({
        name: resource.name,
        id: resource.guid
      }));

      allApps = allApps.concat(apps);

      if (response.data.pagination.total_pages === page) {
        break; // Exit the loop if all pages have been fetched
      }

      page++;
    } catch (error) {
      console.error('Error getting apps', error);
      break;
    }
  }

  appCount = allApps.length;
  allApps.forEach(app => {
    app.lifecycle.data.buildpacks.forEach(buildPack => {
      if (buildPackToAppMap[buildPack]) {
        buildPackToAppMap[buildPack].push(app.name);
      } else {
        buildPackToAppMap[buildPack] = [app.name];
      }
    });
  });

  getEnvForApps();
};


const getEnvForApps = () => {
    axios
        .all(apps.map(({ id, name }) => getEnv({ id, name })))
        .then(responses => {
            responses.forEach(response => {
                const services = [];
                try {
                    const appName = response.application_env_json.VCAP_APPLICATION.application_name;
                    const keys = Object.keys(response.system_env_json.VCAP_SERVICES);

                    keys.forEach(key => {
                        const serviceName = response.system_env_json.VCAP_SERVICES[key][0].name;
                        if (appServiceMap[serviceName]) {
                            appServiceMap[serviceName].push(appName);
                        } else {
                            appServiceMap[serviceName] = [appName];
                        }
                        services.push(serviceName);
                    });
                    appInfo.push({
                        name: appName,
                        organization:
                        response.application_env_json.VCAP_APPLICATION.organization_name,
                        organizationId:
                        response.application_env_json.VCAP_APPLICATION.organization_id,
                        space: response.application_env_json.VCAP_APPLICATION.space_name,
                        spaceId: response.application_env_json.VCAP_APPLICATION.space_id,
                        services: services,
                        routes: response.application_env_json.VCAP_APPLICATION.application_uris
                    });
                    appServices = [...new Set([...appServices, ...services])];
                } catch (error) {
                    console.error(error);
                }
            });
            generateReport();
        })
        .catch(error => {});
};

const getEnv = ({ id, name }) => {
    return new Promise((resolve, reject) => {
        axios({
            method: 'get',
            url: `${CF_ENDPOINT}/v3/apps/${id}/env`,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Authorization: CF_AUTH_TOKEN
            }
        })
            .then(response => {
                resolve(response.data);
            })
            .catch(error => {
                console.error('error getting env for ', name);
                reject(error);
            });
    });
};

const generateReport = () => {
    // Const wb = new xl.Workbook()
    // createWorkSheet({
    //     wb,
    //     data: appInfo,
    //     wbName: 'Applications',
    //     heading: ['name', 'organization', 'organizationId', 'space', 'spaceId', 'services', 'routes']
    // })
    // wb.write('PCF_mapping.xlsx')

    const appInfoXLS = json2xls(appInfo);
    fs.writeFileSync('PCF_mapping.xlsx', appInfoXLS, 'binary');

    // Const appServicesXLS = json2xls(appServices)
    // fs.writeFileSync('PCF_services.xlsx', appServicesXLS, 'binary')

    const appServiceMapXLS = json2xls(appServiceMap);
    fs.writeFileSync('PCF_services_map.xlsx', appServiceMapXLS, 'binary');

    // Const buildPacksXLS = json2xls(buildPacks)
    // fs.writeFileSync('PCF_buildPacks.xlsx', buildPacksXLS, 'binary')

    const buildPackToAppMapXLS = json2xls(buildPackToAppMap);
    fs.writeFileSync('PCF_buildPackToAppMap.xlsx', buildPackToAppMapXLS, 'binary');
    // Console.log('----------------------appServices-----------------------------.', appServices)
    // console.log('----------------------appServiceMap-----------------------------.', appServiceMap)
    // console.log('----------------------buildPacks-----------------------------.', buildPacks)
    // console.log('----------------------buildPackToAppMap-----------------------------.', buildPackToAppMap)
    // console.log('----------------------appInfo-----------------------------.', appInfo)
};

const createWorkSheet = ({ wb, data, wbName, heading }) => {
    const ws = wb.addWorksheet(wbName);

    // Write Column Title in Excel file
    let headingColumnIndex = 1;
    heading.forEach(heading => {
        ws.cell(1, headingColumnIndex++).string(heading);
    });

    // Write Data in Excel file
    let rowIndex = 2;
    data.forEach(record => {
        let columnIndex = 1;
        Object.keys(record).forEach(columnName => {
            ws.cell(rowIndex, columnIndex++).string(record[columnName]);
        });
        rowIndex++;
    });
};
