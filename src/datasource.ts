import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MutableDataFrame,
  FieldType,
  SelectableValue
} from '@grafana/data';
import { CascaderOption } from '@grafana/ui';
import { getBackendSrv, getTemplateSrv } from "@grafana/runtime";

import _ from "lodash";
import defaults from "lodash/defaults";
import { lastValueFrom } from "rxjs";

import {
  MyQuery, MyDataSourceOptions, AllowedRequestType,
  QueryGroupObject, aggregateTimeMap, MyQueryWhere,
  MyVariableQuery, DEFAULT_QUERY
} from './types';


export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  baseUrl: string;
  isRemote?: boolean;
  remoteConfigUrl: string;
  remoteUser?: string;
  remotePassword?: string;
  remoteRoute: string;
  localRoute: string;
  apiUrl: string;
  remoteToken?: string;
  remoteTokenExpire: number;
  getRemoteTokenBody: any;
  headers: object;
  nameIdMaps: any;
  idNameMaps: any;
  nameTypeMaps: any;
  idAssetMaps: any;
  variablesOptions: Array<SelectableValue<string>>;
  variablesOptionsCascader: CascaderOption[];
  aggregateBaseBody: any;
  aggregateTimeMap: any;
  start: number;

  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);

    // console.log("start", instanceSettings);

    // get url of grafana proxy, all requests will be lanuched from server and not from browser
    this.baseUrl = instanceSettings.url!;

    // get url of dataservice app from the config editor
    this.remoteConfigUrl = instanceSettings.jsonData.remoteUrl!;
    this.isRemote = instanceSettings.jsonData.isRemote;
    this.remoteUser = instanceSettings.jsonData.remoteUser;
    this.remotePassword = instanceSettings.jsonData.remotePassword;

    // init local Route for external iih essentials
    this.localRoute = "/edgeappdataservice";

    // init remote Route for local iih essentials
    this.remoteRoute = "/iihadapter";

    // init api url
    this.apiUrl = "";

    // init base headers
    this.headers = {
      "Content-Type": "application/json",
      "accept": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*"
    };

    // init token for remote IED access
    this.remoteToken = "";
    this.remoteTokenExpire = 0;
    this.getRemoteTokenBody = {
      userName: this.remoteUser,
      passWord: this.remotePassword,
    };

    // init base body message for aggregates requests to dataservice
    this.aggregateBaseBody = {
      "from": "",
      "to": "",
      "dataSources": []
    }

    // init map for aggregate time range mapping in milliseconds
    this.aggregateTimeMap = aggregateTimeMap;
    // init maps for variables id to name and name to id
    this.nameIdMaps = {};
    this.idNameMaps = {};
    this.nameTypeMaps = {};
    // init map for assets id to name
    this.idAssetMaps = {};
    // init variables options for query editor select
    this.variablesOptions = [];
    this.variablesOptionsCascader = [];

    // init start time for query performance calculation
    this.start = 0;

    // call function to init token, assets, variables
    this.initPlugin();
  }


  async initPlugin() {
    try {

      // check if remote or local
      if (this.isRemote) {
        // set base url to remote IED if configured
        this.apiUrl = this.baseUrl + this.remoteRoute;
        // get the remote IED token
        await this.getRemoteToken();
      }
      else {
        // set local url iih
        this.apiUrl = this.baseUrl + this.localRoute;
      }

      // get assets and create id name map
      await this.createAssetMap();
      // get variables and create id name maps
      await this.createVariablesMap();
      // get variables and create options for select
      await this.createVariablesOptions();
      // get variables and create options for cascader
      // await this.createVariablesOptionsCascader();

    } catch (error: any) {
      console.log("initPlugin error: ", error);
    }
  }


  getRemoteToken() {
    // call remote IED token API

    // copy main class for nested functions 
    let self = this;

    return new Promise<boolean>((resolve, error) => {

      let url = this.apiUrl + "/device/edge/api/v1/login/direct";

      // if remote set remote ied token
      let headers = { "x-grafana-remotedevice": this.remoteConfigUrl };

      // get remote IED token
      self.customRequest(url, headers, "post", self.getRemoteTokenBody).then(
        (res) => {
          // console.log(res);
          // save access token
          self.remoteToken = res.data.access_token;
          // save next expire timestamp subtracting 1h in ms
          self.remoteTokenExpire = res.data.expires_in - (60 * 60 * 1000);

          resolve(true);
        },
        (err: any) => {
          console.log("getremotetoken error:", err);
          error(err);
        }
      );

    });
  }


  createAssetMap() {
    // call get assets API and create id name map

    // init headers and url for API call
    let headers = {};
    let url = "/AssetService/Assets";

    // check if remote
    if (this.isRemote) {
      // if remote set remote ied token
      //headers = { Cookie: "authToken=" + this.remoteToken };
      headers = {
        "x-grafana-remotedevice": this.remoteConfigUrl,
        "x-grafana-remotetoken": this.remoteToken
      };
      // and add iih-essentials route to url
      url = this.apiUrl + "/iih-essentials" + url;
    }
    else {
      url = this.apiUrl + url;
    }

    // copy main class for nested functions
    let self = this;

    // console.log(this);

    return new Promise<boolean>((resolve, error) => {
      // make request for variables list
      self.customGetRequest(url, headers).then(
        (res: any) => {
          // console.log(res);
          // check if assets are available
          if (res.data.hasOwnProperty("assets")) {

            // init asset map
            let idAssetsMap: { [index: string]: any } = {}
            // init list of assets
            let idAssetsList = [];

            // first loop for creating each asset in the asset map
            for (let i = 0; i < res.data.assets.length; i++) {
              // get the current asset
              let asset = res.data.assets[i];
              // init the asset properties
              idAssetsMap[asset.assetId.toString()] = {
                hasParent: false,
                parents: [],
                parentsNames: [],
                name: asset.name,
                id: asset.assetId.toString(),
              };
              // if the asset has a parent
              if (asset.parentId !== "") {
                // get first parent asset of the actual asset
                let parentId = asset.parentId.toString();
                // assign the parent asset properties
                idAssetsMap[asset.assetId].hasParent = true;
                idAssetsMap[asset.assetId].parents.push(parentId);
              }

              // push asset to list
              idAssetsList.push(asset.assetId.toString());
            }

            // second loop for assigning tree parent structure to each asset element
            for (let i = 0; i < res.data.assets.length; i++) {
              // get the current asset
              let asset = res.data.assets[i];
              // if the asset has a parent
              if (asset.parentId !== "") {
                // get first parent asset of the actual asset
                let parentId = asset.parentId.toString();
                // loop on the tree of the parents inserting the parents assets in the parent list
                while (idAssetsMap[parentId].hasParent) {
                  parentId =
                    idAssetsMap[parentId].parents[idAssetsMap[parentId].parents.length - 1];
                  idAssetsMap[asset.assetId].parents.unshift(parentId);
                }
              }
            }

            // third loop to create a parents names list based on parents id list
            for (let i = 0; i < idAssetsList.length; i++) {
              // get the asset element in assets map
              let asset = idAssetsMap[idAssetsList[i]];
              if (asset.hasParent) {
                // for each parent find the corresponding name
                for (let j = 0; j < asset.parents.length; j++) {
                  asset.parentsNames.push(idAssetsMap[asset.parents[j]].name);
                }
              }
            }

            // save created asset map to global
            self.idAssetMaps = idAssetsMap;

            resolve(true);
          } else {
            console.log("No assets found.");
            resolve(false);
          }
        },
        (err: any) => {
          console.log("createassetsmap error:", err);
          error(false);
        }
      );
    });
  }


  createVariablesMap() {
    // call get variables API and create id name and name id maps

    // init headers and url for API call
    let headers = {};
    let url = "/DataService/Variables";

    // check if remote
    if (this.isRemote) {
      // if remote set remote ied token
      //headers = { Cookie: "authToken=" + this.remoteToken };
      headers = {
        "x-grafana-remotedevice": this.remoteConfigUrl,
        "x-grafana-remotetoken": this.remoteToken
      };
      // and add iih-essentials route to url
      url = this.apiUrl + "/iih-essentials" + url;
    }
    else {
      url = this.apiUrl + url;
    }


    // copy main class for nested functions
    let self = this;

    return new Promise<boolean>((resolve, error) => {
      // make request for variables list
      self.customGetRequest(url, headers).then(
        (res: any) => {
          // check if variables are available
          if (res.data.hasOwnProperty("variables")) {
            // loop over variables array
            for (let i = 0; i < res.data.variables.length; i++) {

              // get asset belonging to the variable
              // 1. { hasParent: false, parentsNames: [], name: edge }
              // 2. { hasParent: true, parentsNames: [edge], name: asset }
              // 3. { hasParent: true, parentsNames: [edge, asset], name: subasset }
              let asset = this.idAssetMaps[res.data.variables[i].assetId];

              // init asset tree name
              let assetTreeName = "";
              // check if asset has parents and create base name with asset tree
              if (asset.hasParent) {
                // add to the asset tree name each level of assets names
                // 2. edge.
                // 3. edge.asset.
                assetTreeName = asset.parentsNames.join(".") + ".";
              }
              // add name of the asset containing the variable to the asset tree name
              // 1. edge
              // 2. edge.asset
              // 3. edge.asset.subasset
              assetTreeName += asset.name;

              // create the complete asset+variable tree name
              // 1. edge.variable
              // 2. edge.asset.variable
              // 3. edge.asset.subasset.variable
              let varName = assetTreeName + "." + res.data.variables[i].variableName;

              //create map properties as "varName": varId
              self.nameIdMaps[varName] = res.data.variables[i].variableId;
              self.idNameMaps[res.data.variables[i].variableId] = varName;
              self.nameTypeMaps[varName] = res.data.variables[i].dataType;
            }

            resolve(true);
          } else {
            console.log("No variables.");
            resolve(false);
          }
        },
        (err: any) => {
          console.log("createvariablesmap error:", err);
          error(false);
        }
      );
    });
  }


  createVariablesOptions() {
    // call get variables API and create options list for select variable options in the UI

    // init headers and url for API call
    let headers = {};
    let url = "/DataService/Variables";

    // check if remote
    if (this.isRemote) {
      // if remote set remote ied token
      //headers = { Cookie: "authToken=" + this.remoteToken };
      headers = {
        "x-grafana-remotedevice": this.remoteConfigUrl,
        "x-grafana-remotetoken": this.remoteToken
      };
      // and add iih-essentials route to url
      url = this.apiUrl + "/iih-essentials" + url;
    }
    else {
      url = this.apiUrl + url;
    }


    // copy main class for nested functions
    let self = this;

    // reset options
    self.variablesOptions = [];

    return new Promise<Array<SelectableValue<string>>>((resolve, error) => {

      // get grafana variables as options for select
      let grafanaVariables = getTemplateSrv().getVariables() as any;
      // console.log(grafanaVariables);

      if (grafanaVariables.length > 0) {
        self.variablesOptions.push({ label: "Grafana Variables", value: "Grafana Variables", options: [] })
      }

      // loop over grafana variables
      for (let i = 0; i < grafanaVariables.length; i++) {
        // check variable type
        if (grafanaVariables[i].type === "custom" || grafanaVariables[i].type === "query") {
          // custom and query variables can have multiple options
          let numOptions = grafanaVariables[i].options.length;
          // remove the All option if present
          if (grafanaVariables[i].includeAll) {
            numOptions = numOptions - 1;
          }
          // loop over options
          for (let j = 0; j < numOptions; j++) {
            // create option as grafana variable name + _ + option index
            self.variablesOptions[0].options.push({
              label: "${" + grafanaVariables[i].name + "_" + j + "}",
              value: "${" + grafanaVariables[i].name + "_" + j + "}",
            });
          }
        }
        else if (grafanaVariables[i].type === "constant" || grafanaVariables[i].type === "textbox") {
          // constant and textbox variables have only one option
          // create option as grafana variable name
          self.variablesOptions[0].options.push({
            label: "${" + grafanaVariables[i].name + "}",
            value: "${" + grafanaVariables[i].name + "}",
          });
        }
      }

      // request var list
      self.customGetRequest(url, headers).then(
        (res: any) => {
          // console.log(res);
          // check if variables are available
          if (res.data.hasOwnProperty("variables")) {

            // init variables options list
            let tmpVarOptions: Array<SelectableValue<string>> = [];

            // loop over variables array
            for (let i = 0; i < res.data.variables.length; i++) {

              // get asset belonging to the variable
              // 1. { hasParent: false, parentsNames: [], name: edge }
              // 2. { hasParent: true, parentsNames: [edge], name: asset }
              // 3. { hasParent: true, parentsNames: [edge, asset], name: subasset }
              let asset = this.idAssetMaps[res.data.variables[i].assetId];

              // init asset tree name
              let assetTreeName = "";
              // check if asset has parents and create base name with asset tree
              if (asset.hasParent) {
                // add to the asset tree name each level of assets names
                // 2. edge.
                // 3. edge.asset.
                assetTreeName = asset.parentsNames.join(".") + ".";
              }
              // add name of the asset containing the variable to the asset tree name
              // 1. edge
              // 2. edge.asset
              // 3. edge.asset.subasset
              assetTreeName += asset.name;

              // create the complete asset+variable tree name
              // 1. edge.variable
              // 2. edge.asset.variable
              // 3. edge.asset.subasset.variable
              let varName = assetTreeName + "." + res.data.variables[i].variableName;

              // create option
              tmpVarOptions.push({
                label: varName,
                value: varName,
              });
            }

            // order ascending options list
            tmpVarOptions.sort((a, b) =>
              typeof a.value === "string" && typeof b.value === "string" ? a.value.localeCompare(b.value) : 0
            );

            // concat the grafana variables options with the variables options
            self.variablesOptions = self.variablesOptions.concat(tmpVarOptions);

            // console.log(self.variablesOptions);
            resolve(self.variablesOptions);
          } else {
            console.log("No variables found.");
            resolve(self.variablesOptions);
          }
        },
        (err: any) => {
          console.log("createvariablesoptions error:", err);
          error(false);
        }
      );
    });
  }


  // variablesToCascaderOptions(variables: any[]) {
  //   // create options for cascader based on variables list

  //   try {
  //     // copy main class for nested functions
  //     let self = this;

  //     // Array to store the cascader options
  //     let cascaderOptions: CascaderOption[] = [];
  //     // console.log(self.idAssetMaps);

  //     // Iterate through the assetObject keys to initiate the transformation
  //     for (const assetId in self.idAssetMaps) {
  //       // Retrieve the current asset from the assetObject
  //       const asset = self.idAssetMaps[assetId.toString()];
  //       if (asset) {
  //         let currentLevelIndex = 0;
  //         if (asset.hasParent) {
  //           // Copy parents to avoid modifying the original array
  //           const parentNamesCopy = asset.parentsNames.slice();
  //           // Init the current level as root cascade level
  //           let currentLevel: CascaderOption[] = cascaderOptions;
  //           // Iterate through parent names to build the hierarchy
  //           while (parentNamesCopy.length > 0) {
  //             // get the first parent name in the array and shift it from array
  //             const parentName = parentNamesCopy.shift();
  //             // Find the parent item in the current level
  //             let parentItem = currentLevel.find((item) => item.label === parentName);
  //             // If the parent item doesn't exist, create it
  //             if (!parentItem) {
  //               // create the parent item with the parent name and id
  //               parentItem = {
  //                 label: parentName,
  //                 value: "£$%&" + "A" + "£$%&" + currentLevelIndex + "£$%&" + parentName,
  //                 items: [],
  //               };
  //               currentLevel.push(parentItem);
  //             }
  //             // Move to the next level in the hierarchy
  //             currentLevel = parentItem.items as CascaderOption[];
  //             currentLevelIndex++;
  //           }
  //           if (currentLevel.find((item) => item.label === asset.name) === undefined) {
  //             // Add the new item to the appropriate level in the hierarchy
  //             currentLevel.push({
  //               label: asset.name,
  //               value: "£$%&" + "A" + "£$%&" + currentLevelIndex + "£$%&" + asset.name,
  //               items: [],
  //             });
  //           }
  //         } else {
  //           // If the asset has no parent, add the new item directly to the top level
  //           cascaderOptions.push({
  //             label: asset.name,
  //             value: "£$%&" + "A" + "£$%&" + currentLevelIndex + "£$%&" + asset.name,
  //             items: [],
  //           });
  //         }
  //       }
  //     }
  //     // console.log(cascaderOptions);

  //     // order by names ascending variables list
  //     variables.sort((a, b) =>
  //       typeof a.variableName === "string" && typeof b.variableName === "string" ? a.variableName.localeCompare(b.variableName) : 0
  //     );

  //     // Loop over variables to add them to the previous created cascader options
  //     for (let i = 0; i < variables.length; i++) {
  //       const variable = variables[i];
  //       // get the asset where variable belong
  //       const asset = self.idAssetMaps[variable.assetId];
  //       if (asset) {
  //         // get the asset tree of the parent asset and push the asset itself
  //         let parentsNamesCopy = asset.parentsNames.slice();
  //         parentsNamesCopy.push(asset.name);
  //         // Init the current level as root cascade level
  //         let currentLevel: CascaderOption[] = cascaderOptions;
  //         let currentLevelIndex = 0;
  //         // Iterate through parent names to find the right asset option
  //         while (parentsNamesCopy.length > 0) {
  //           // get the first parent name in the array and shift it from array
  //           let parentName = parentsNamesCopy.shift();
  //           // Find the parent item in the current level
  //           let parentItem = currentLevel.find((item) => item.label === parentName);
  //           if (parentItem) {
  //             // if the parent item is the item itself push the new option to the item
  //             if (asset.name === parentName) {
  //               parentItem.items?.push({
  //                 label: variable.variableName,
  //                 value: "£$%&" + "V" + "£$%&" + (currentLevelIndex + 1) + "£$%&" + variable.variableName,
  //               });
  //               break;
  //             }
  //             // Move to the next level in the hierarchy
  //             currentLevel = parentItem.items as CascaderOption[];
  //           }
  //           currentLevelIndex++;
  //         }
  //       }
  //     }
  //     // console.log(cascaderOptions);

  //     return cascaderOptions;
  //   }
  //   catch (error: any) {
  //     console.log("variablestocascaderoptions error: ", error);
  //     return [];
  //   }
  // }


  // grafanaVariablesToCascaderOptions(grafanaVariables: any[]) {
  //   // create options for cascader based on grafana variables list

  //   // init cascader options
  //   let cascaderOptions: CascaderOption[] = [];

  //   // if some grafana variables are present create root cascader option for them
  //   if (grafanaVariables.length > 0) {
  //     cascaderOptions.push({ label: "Dashboard Variables", value: "Dashboard Variables", items: [] })
  //   }

  //   // loop over grafana variables
  //   for (let i = 0; i < grafanaVariables.length; i++) {
  //     let variable = grafanaVariables[i];
  //     if (cascaderOptions[0]?.items) {
  //       // check variable type
  //       if (variable.type === "custom" || variable.type === "query") {
  //         // custom and query variables can have multiple options
  //         // a intermediate level is created for each variable
  //         // inside items are the options of each variable

  //         // push variable as option and init its items array
  //         let actOptionIndex = (cascaderOptions[0].items.push({
  //           label: "${" + variable.name + "}",
  //           value: "${" + variable.name + "}", items: []
  //         })) - 1;
  //         // find the number of options for the variable
  //         let numOptions = variable.options.length;
  //         // remove the "All" option if present
  //         if (variable.includeAll) {
  //           numOptions = numOptions - 1;
  //         }
  //         // loop over options
  //         for (let j = 0; j < numOptions; j++) {
  //           if (cascaderOptions[0]?.items[actOptionIndex]?.items ?? false) {
  //             // create option item inside the variable item
  //             cascaderOptions[0].items[actOptionIndex]?.items?.push({
  //               label: "Option " + (j + 1),
  //               value: (j + 1).toString(),
  //             });
  //           }
  //         }
  //       }
  //       else if (variable.type === "constant" || variable.type === "textbox") {
  //         // constant and textbox variables have only one option
  //         // create option as grafana variable name
  //         cascaderOptions[0].items.push({
  //           label: "${" + variable.name + "}",
  //           value: "${" + variable.name + "}",
  //         });
  //       }
  //     }
  //   }

  //   return cascaderOptions;
  // }


  // createVariablesOptionsCascader() {
  //   // call get variables API and create options list for select variable options in the UI

  //   // init headers and url for API call
  //   let headers = {};
  //   let url = "/DataService/Variables";

  //   // check if remote
  //   if (this.isRemote) {
  //     // if remote set remote ied token
  //     //headers = { Cookie: "authToken=" + this.remoteToken };
  //     headers = {
  //       "x-grafana-remotedevice": this.remoteConfigUrl,
  //       "x-grafana-remotetoken": this.remoteToken
  //     };
  //     // and add iih-essentials route to url
  //     url = this.apiUrl + "/iih-essentials" + url;
  //   }
  //   else {
  //     url = this.apiUrl + url;
  //   }


  //   // copy main class for nested functions
  //   let self = this;


  //   return new Promise<CascaderOption[]>((resolve, error) => {

  //     // reset options
  //     self.variablesOptionsCascader = [];

  //     // get grafana variables as options for select
  //     let grafanaVariables = getTemplateSrv().getVariables() as any;
  //     // console.log(grafanaVariables);
  //     // if some grafana variables are present create root cascader option for them
  //     self.variablesOptionsCascader = self.grafanaVariablesToCascaderOptions(grafanaVariables);
  //     // console.log(self.variablesOptionsCascader);

  //     // request var list
  //     self.customGetRequest(url, headers).then(
  //       (res: any) => {
  //         // console.log(res);
  //         // check if variables are available
  //         if (res.data.hasOwnProperty("variables")) {
  //           // create options for cascader based on received variables list
  //           let tmpVarOptions = self.variablesToCascaderOptions(res.data.variables);
  //           // concat the grafana variables options with the variables options
  //           self.variablesOptionsCascader = self.variablesOptionsCascader.concat(tmpVarOptions);
  //           // resolve the options list
  //           resolve(self.variablesOptionsCascader);
  //         } else {
  //           console.log("No variables found.");
  //           resolve(self.variablesOptionsCascader);
  //         }
  //       },
  //       (err: any) => {
  //         console.log("createvariablesoptions error:", err);
  //         error(false);
  //       }
  //     );
  //   });
  // }


  applyWhereClause(value: any, comparator: string, element2: string) {

    // possible comparators: =, !=, <, >, <=, >=, includes, not includes, starts with, ends with
    // apply comparator to value and element2 and return the result
    try {

      if (comparator === "=") {
        value = value === undefined ? "undefined" : value;
        return value.toString() === element2.toString();
      }
      else if (comparator === "!=") {
        value = value === undefined ? "undefined" : value;
        return value.toString() !== element2.toString();
      }
      else if (comparator === "<" && value !== undefined) {
        return Number(value) < Number(element2);
      }
      else if (comparator === ">" && value !== undefined) {
        return Number(value) > Number(element2);
      }
      else if (comparator === "<=" && value !== undefined) {
        return Number(value) > Number(element2);
      }
      else if (comparator === ">=" && value !== undefined) {
        return Number(value) > Number(element2);
      }
      else if (comparator === "includes" && value !== undefined) {
        return value.toString().includes(element2.toString());
      }
      else if (comparator === "not includes" && value !== undefined) {
        return !value.toString().includes(element2.toString());
      }
      else if (comparator === "starts with" && value !== undefined) {
        return value.toString().startsWith(element2.toString());
      }
      else if (comparator === "ends with" && value !== undefined) {
        return value.toString().endsWith(element2.toString());
      }
      else {
        return false;
      }

    } catch (error: any) {
      console.log("applyWhereClause error: ", error);
    }
  }


  queryData(timeBuffer: string[], dataBuffer: any,
    ids: string, from: string, to: string, order: string) {
    // call get raw data API, extract data to temp fields and update main buffer data

    // init headers and url for API call
    let headers = {};
    let url = "/DataService/Data";

    // check if remote
    if (this.isRemote) {
      // if remote set remote ied token
      //headers = { Cookie: "authToken=" + this.remoteToken };
      headers = {
        "x-grafana-remotedevice": this.remoteConfigUrl,
        "x-grafana-remotetoken": this.remoteToken
      };
      // and add iih-essentials route to url
      url = this.apiUrl + "/iih-essentials" + url;
    }
    else {
      url = this.apiUrl + url;
    }


    // copy main class for nested functions
    let self = this;

    return new Promise((resolve, error) => {

      // create query string for dataservice
      const queryParams = `variableIds=${ids}&from=${from}&to=${to}&order=${order}`;

      // start request
      self.customGetRequest(url, headers, "json", queryParams).then(
        (res: any) => {
          // get datapoints array from response
          let datapoints = res.data.data;
          // init time index used for all buffers arrays
          let tIndex = -1;
          // console.log(res.data);
          // loop over datapoints
          for (let i = 0; i < datapoints.length; i++) {
            // create query variable name based on variable id and aggregate mode
            let queryVarName = datapoints[i].variableId + "_None";
            // loop over values of the current datapoint
            for (let j = 0; j < datapoints[i].values.length; j++) {
              // search for the timestamp in the timestamps buffer, if not found add it and save the index
              tIndex = timeBuffer.indexOf(datapoints[i].values[j].timestamp);
              if (tIndex === -1) {
                timeBuffer.push(datapoints[i].values[j].timestamp);
                tIndex = timeBuffer.length - 1;
              }
              // save the value in the data array in the same position of the timestamp
              dataBuffer[queryVarName][tIndex] = datapoints[i].values[j].value;
            }
          }
          // console.log(dataBuffer);

          if (!res.data.hasOwnProperty("hasMoreData")) {
            // console.log("finish");
            resolve({
              queryFinished: true,
              queryFrom: "",
              queryTo: "",
              timeBuffer: timeBuffer,
              dataBuffer: dataBuffer,
            });
          } else {
            // if query has still data update the time range for next loop query
            resolve({
              queryFinished: false,
              queryFrom: res.data.hasMoreData.from,
              queryTo: res.data.hasMoreData.to,
              timeBuffer: timeBuffer,
              dataBuffer: dataBuffer,
            });
          }
        },
        (err: any) => {
          console.log("querydata error", err);
          error(false);
        }
      );
    });
  }


  queryDataAggregateTrend(
    timeBuffer: string[],
    dataBuffer: any,
    ids: string[],
    from: string,
    to: string,
    aggregateModes: string[],
    aggregateTime: number
  ) {
    // call get aggregate trend data API, extract data to temp fields and update main buffer data

    // init headers and url for API call
    let headers = {};
    let url = "/DataService/CalculateTrend";

    // init base body
    let baseAggregateBody = this.aggregateBaseBody;

    // check if remote
    if (this.isRemote) {
      // if remote set remote ied token
      //headers = { Cookie: "authToken=" + this.remoteToken };
      headers = {
        "x-grafana-remotedevice": this.remoteConfigUrl,
        "x-grafana-remotetoken": this.remoteToken
      };
      // and add iih-essentials route to url
      url = this.apiUrl + "/iih-essentials" + url;
    }
    else {
      url = this.apiUrl + url;
    }


    // copy main class for nested functions
    let self = this;

    return new Promise((resolve, error) => {

      // create query body based on base body
      const aggregateBody = {
        ...baseAggregateBody,
        from: from,
        to: to,
        calculationTimeRange: aggregateTime,
        dataSources: [],
      };

      // push variables to query body by using ids string
      for (let i = 0; i < ids.length; i++) {
        aggregateBody.dataSources.push({
          type: "Variable",
          id: ids[i],
          aggregation: aggregateModes[i],
        });
      }

      // start request
      self
        .customRequest(url, headers, "post", aggregateBody)
        .then(
          (res: any) => {
            // get datapoints array from response
            let datapoints = res.data;

            // init time index used for all buffers arrays
            let tIndex = -1;
            // console.log(res.data);
            // loop over datapoints
            for (let i = 0; i < datapoints.length; i++) {
              // create query variable name based on variable id and aggregate mode
              let queryVarName = datapoints[i].dataSource.id + "_" + datapoints[i].dataSource.aggregation;
              // loop over values of the current datapoint
              for (let j = 0; j < datapoints[i].values.length; j++) {
                // search for the timestamp in the timestamps buffer, if not found add it and save the index
                tIndex = timeBuffer.indexOf(datapoints[i].values[j].timestamp);
                if (tIndex === -1) {
                  timeBuffer.push(datapoints[i].values[j].timestamp);
                  tIndex = timeBuffer.length - 1;
                }
                // save the value in the temporary array in the same position of the timestamp
                dataBuffer[queryVarName][tIndex] = datapoints[i].values[j].value;
              }
            }
            // console.log(dataBuffer);

            if (!res.data.hasOwnProperty("hasMoreData")) {
              // console.log("finish");
              resolve({
                queryFinished: true,
                queryFrom: "",
                queryTo: "",
                timeBuffer: timeBuffer,
                dataBuffer: dataBuffer,
              });
            } else {
              // if query has still data update the time range for next loop query
              resolve({
                queryFinished: false,
                queryFrom: res.data.hasMoreData.from,
                queryTo: res.data.hasMoreData.to,
                timeBuffer: timeBuffer,
                dataBuffer: dataBuffer,
              });
            }
          },
          (err: any) => {
            console.log("querydataaggregatetrend error:", err);
            error(false);
          }
        );
    });
  }


  queryDataAggregate(
    timeBuffer: string[],
    dataBuffer: any,
    ids: string[],
    from: string,
    to: string,
    aggregateModes: string[]
  ) {
    // call get aggregate data API, extract data to temp fields and update main buffer data
    // this API return only 1 value!

    // init headers and url for API call
    let headers = {};
    let url = "/DataService/Calculate";


    // check if remote
    if (this.isRemote) {
      // if remote set remote ied token
      //headers = { Cookie: "authToken=" + this.remoteToken };
      headers = {
        "x-grafana-remotedevice": this.remoteConfigUrl,
        "x-grafana-remotetoken": this.remoteToken
      };
      // and add iih-essentials route to url
      url = this.apiUrl + "/iih-essentials" + url;
    }
    else {
      url = this.apiUrl + url;
    }

    // copy main class for nested functions
    let self = this;

    return new Promise((resolve, error) => {
      // create query body
      const aggregateBody = {
        ...self.aggregateBaseBody,
        from: from,
        to: to,
        dataSources: [],
      };

      // push variables to query body by using ids string
      for (let i = 0; i < ids.length; i++) {
        aggregateBody.dataSources.push({
          type: "Variable",
          id: ids[i],
          aggregation: aggregateModes[i],
        });
      }

      // start request
      self.customRequest(url, headers, "post", aggregateBody).then(
        (res: any) => {
          // get datapoints array from response
          let datapoints = res.data;
          // console.log(res.data);

          // init time index used for all buffers arrays
          let tIndex = -1;
          // console.log(res.data);
          // loop over datapoints
          for (let i = 0; i < datapoints.length; i++) {
            // create query variable name based on variable id and aggregate mode
            let queryVarName = datapoints[i].dataSource.id + "_" + datapoints[i].dataSource.aggregation;
            // search for the timestamp in the timestamps buffer, if not found add it and save the index
            tIndex = timeBuffer.indexOf(to);
            if (tIndex === -1) {
              // if timebuffer is empty push to value, else use the last timestamp already present
              if (timeBuffer.length === 0) {
                timeBuffer[0] = to;
                tIndex = 0;
              }
              else {
                tIndex = timeBuffer.length - 1;
              }
            }
            // save the value in the data array in the same position of the timestamp
            dataBuffer[queryVarName][tIndex] = datapoints[i].value;
          }

          // only one value will be returned, so we can finish the query
          resolve({ queryFinished: true, timeBuffer: timeBuffer, dataBuffer: dataBuffer });
        },
        (err: any) => {
          console.log("querydataaggregate error:", err);
          error(false);
        }
      );
    });
  }


  async queryLoop(
    timeBuffer: string[],
    dataBuffer: any,
    queryObject: QueryGroupObject,
    from: string,
    to: string,
    order: string,
    aggregateTime: number
  ) {
    // this function handle multiple queries till the results are all available based on dataservice responses

    // initialize loop properties
    let queryFrom = from;
    let queryTo = to;
    let tBuf = timeBuffer;
    let dBuf = dataBuffer;
    // define the query groups types
    let queryGroups: string[] = ["Data", "Aggregate", "AggregateTrend"];
    // loop over the query groups
    for (let i = 0; i < queryGroups.length; i++) {
      let queryGroupName = queryGroups[i];
      // initialize the query finished flag
      let queryFinished = false;
      // check the query type and run the corresponding query function
      if (queryGroupName === "Data") {
        // create ids string for query
        let ids = '["' + queryObject.Data.variablesIdsList.join('","') + '"]';
        // a for loop that handle multiple data requests
        for (let j = 1; !queryFinished && j < 99999; j++) {
          // delay needed to avoid too requests overlapping
          await this.delay(150);

          // run raw data query
          this.queryData(tBuf,
            dBuf,
            ids,
            queryFrom,
            queryTo,
            order)
            .then((res: any) => {
              // update buffers
              tBuf = res.timeBuffer;
              dBuf = res.dataBuffer;

              if (res.queryFinished) {
                queryFinished = true;
              } else {
                // update time range for next loop
                queryFrom = res.queryFrom;
                queryTo = res.queryTo;
              }
            })
            .catch((err: any) => console.log("queryloopdata error:", err));
        }
      } else if (queryGroupName === "AggregateTrend") {
        // a for loop that handle multiple data requests
        for (let j = 1; !queryFinished && j < 99999; j++) {
          // delay needed to avoid too requests overlapping
          await this.delay(150);

          // run aggregate trend query
          this.queryDataAggregateTrend(tBuf,
            dBuf,
            queryObject.AggregateTrend.variablesIdsList,
            queryFrom,
            queryTo,
            queryObject.AggregateTrend.aggregateModesList,
            aggregateTime)
            .then((res: any) => {
              // update buffers
              tBuf = res.timeBuffer;
              dBuf = res.dataBuffer;

              if (res.queryFinished) {
                queryFinished = true;
              } else {
                // update time range for next loop
                queryFrom = res.queryFrom;
                queryTo = res.queryTo;
              }
            })
            .catch((err: any) => console.log("queryloopaggregatetrend error:", err));
        }
      } else if (queryGroupName === "Aggregate") {
        await this.delay(150);

        // run single aggregate query
        this.queryDataAggregate(tBuf,
          dBuf,
          queryObject.Aggregate.variablesIdsList,
          queryFrom,
          queryTo,
          queryObject.Aggregate.aggregateModesList)
          .then((res: any) => {
            // update buffers
            tBuf = res.timeBuffer;
            dBuf = res.dataBuffer;

            if (res.queryFinished) {
              queryFinished = true;
            }
          })
          .catch((err: any) => console.log("queryloopaggregate error:", err));
      }
    }

    return { timeBuffer: tBuf, dataBuffer: dBuf };
  }


  async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
    // the query method for Grafana
    const promises = options.targets.map(async (target) => {

      // the query object from panel
      const query: any = defaults(target, DEFAULT_QUERY);
      // console.log("query", query);

      // init grafana response fields
      let fields: any[] = [];

      // check token based on version
      let tokenCheck = false;

      if (this.isRemote) {
        // if IED token has expired or empty renew it
        if (new Date().getTime() > this.remoteTokenExpire || this.remoteToken === "") {
          await this.getRemoteToken();
          await this.createAssetMap();
          await this.createVariablesMap();
          await this.createVariablesOptions();
          // await this.createVariablesOptionsCascader();
        }
        // if IED token exist pass check
        if (this.remoteToken !== "") {
          tokenCheck = true;
        }
      }
      else {
        // if is local no need for IED token
        tokenCheck = true;
      }

      // if previous check of token was successful
      if (tokenCheck) {
        //this.start = new Date().getTime();

        // if grafana variables are used in variablesnames field, replace them
        let varNamesList = query.variablesNamesList;
        // console.log("varNamesList", varNamesList);
        // if grafana variables are used in from and to fields, replace them
        let from = getTemplateSrv().replace(query.from, options.scopedVars);
        let to = getTemplateSrv().replace(query.to, options.scopedVars);
        // get the requested order mode
        let queryOrder = query.order === "Descending" ? "Descending" : "Ascending";
        // get the list of aliases
        let aliasesList = query.aliasesList;
        // get the requested aggregation mode list
        let queryAggregateModes = query.aggregateModesList;
        // get the aggregate time in ms
        let queryAggregateTime = this.aggregateTimeMap[query.aggregateTime];
        // get the query where clause
        let queryWhere = query.where || { items: [], operators: [] };
        // console.log("queryWhere", queryWhere);

        // get the grafana variables
        let grafanaVariables = getTemplateSrv().getVariables() as any;
        // console.log("grafanaVariables", grafanaVariables);

        // generate query groups, some lists with variables properties and the field names
        let fvRes: any = await this.createQueryProperties(
          varNamesList,
          grafanaVariables,
          queryAggregateModes,
          queryAggregateTime,
          aliasesList);
        let queryGroups = fvRes.queryGroups;
        let queryVarNameList = fvRes.queryVarNameList;
        let queryVarIdList = fvRes.queryVarIdList;
        let queryVarTypeList = fvRes.queryVarTypeList;
        let fieldNames = fvRes.fieldNames;
        // console.log(queryVarNameList);
        // console.log(fieldNames);
        // console.log(queryGroups);

        // based on the query configuration generate the where clause for the query
        let gwcRes: any = await this.generateWhereClause(queryWhere, queryVarIdList, grafanaVariables);
        let whereClauseActiveCheck = gwcRes.whereClauseActiveCheck;
        let whereClauseActive = gwcRes.whereClauseActive;
        queryWhere = gwcRes.queryWhere;
        // console.log("queryWhere", queryWhere);

        // check if the from and to are valid and if there is some field to query
        if (
          new Date(from).getTime() > 0
          && new Date(to).getTime() > 0
          && new Date(from).getTime() < new Date(to).getTime()
          && fieldNames.length > 0
        ) {
          // format dates to ISO string for the query
          from = new Date(from).toISOString();
          // if to is greater than now, set it to now
          to = new Date(to).getTime() > new Date().getTime() ? new Date().toISOString() : new Date(to).toISOString();

          // reset the buffers
          let dataBuffer: any = {};
          queryVarNameList.map((name: string) => (dataBuffer[name] = []));
          let timeBuffer: string[] = [];

          // start the query
          const queryFinish = await this.queryLoop(
            timeBuffer,
            dataBuffer,
            queryGroups,
            from,
            to,
            queryOrder,
            queryAggregateTime
          );
          // console.log(timeBuffer);
          // console.log(dataBuffer);

          // based on the data received format them to create the grafana fields to be sent to page
          let fqRes: any = await this.formatQueryResult(
            fields,
            queryFinish,
            queryVarNameList,
            queryVarIdList,
            queryVarTypeList,
            queryOrder,
            queryGroups,
            whereClauseActiveCheck,
            whereClauseActive,
            queryWhere,
            fieldNames
          );
          fields = fqRes.fields;
        }
      }
      // console.log(new Date().getTime() - this.start);
      // console.log("fields", fields);

      // return the grafana fields
      return new MutableDataFrame({
        refId: query.refId,
        fields: fields,
      });
    });

    return Promise.all(promises).then((data) => ({ data }));
  }


  createQueryProperties(
    varNamesList: string[],
    grafanaVariables: any,
    queryAggregateModes: string[],
    queryAggregateTime: number,
    aliasesList: string[]) {

    return new Promise((resolve, error) => {

      // create the query object containing the variables ids and the aggregate modes for each API type
      let queryGroups: QueryGroupObject = {
        Data: {
          variablesIdsList: []
        },
        Aggregate: {
          variablesIdsList: [],
          aggregateModesList: []
        },
        AggregateTrend: {
          variablesIdsList: [],
          aggregateModesList: []
        }
      };
      // create the query variables names (id + agg mode) list and the field names list
      let queryVarNameList: string[] = [];
      let queryVarIdList: string[] = [];
      let queryVarTypeList: string[] = [];
      let fieldNames: string[] = [];

      // loop over the variables names list
      for (let i = 0; i < varNamesList.length; i++) {
        let varName = varNamesList[i];

        // check if the variable name is valid
        if (varName !== "" && varName !== undefined && varName !== "undefined" && varName !== null) {

          // if the variable name is a grafana variable
          if (varName.startsWith("${") && varName.endsWith("}")) {
            // from ${varname} to varname or ${varname_1} to varname_1
            let dashboardVar = varName.substring(2, varName.length - 1);
            // from varname to [varname] or varname_1 to [varname, 1]
            let splitDashboardVar = dashboardVar.split("_");
            // index of the option in the grafana variables list or -1 if no _ is present
            let grafanaOptionIndex = splitDashboardVar.length > 1 ? Number(splitDashboardVar[splitDashboardVar.length - 1]) : 0;
            // variable name without index
            let grafanaVarName = splitDashboardVar.length > 1 ? splitDashboardVar.slice(0, -1).join("_") : splitDashboardVar[0];
            // get the variable object from the grafana variables list filtering by name
            let grafanaVar = grafanaVariables.filter((v: any) => v.name === grafanaVarName);
            // if the variable is found
            if (grafanaVar.length > 0) {
              // based on the variable type get the value of the option
              if (grafanaVar[0].type === "textbox" || grafanaVar[0].type === "constant") {
                varName = grafanaVar[0].current.value;
              }
              else if (grafanaVar[0].type === "query" || grafanaVar[0].type === "custom") {
                // get the selected option
                let option = grafanaVar[0].options[grafanaVar[0].includeAll ? grafanaOptionIndex + 1 : grafanaOptionIndex];
                if (option.selected) {
                  varName = option.value;
                }
                else {
                  // if the option is not selected, the variable will be discarded
                  break;
                }
              }
            }
            else {
              // if the option is not found, the variable will be discarded
              break;
            }
          }

          // get the variable id and the aggregate mode
          let aggregateMode = queryAggregateModes[i];
          let variableId = this.nameIdMaps[varName];
          // get the alias name
          let alias = aliasesList[i];

          // check if the variable id is valid
          if (variableId !== undefined && variableId !== null && variableId !== "undefined" && variableId !== "") {
            // check if the alias name is a grafana variable
            let aliasIndexStart = alias.indexOf("${");
            let aliasIndexEnd = alias.indexOf("}");
            if (aliasIndexStart !== -1 && aliasIndexEnd !== -1) {
              // from alias_${varname_1}_chart to varname_1
              let dashboardVar = alias.substring(aliasIndexStart + 2, aliasIndexEnd);
              // from varname to [varname] or varname_1 to [varname, 1]
              let splitDashboardVar = dashboardVar.split("_");
              // index of the option in the grafana variables list or -1 if no _ is present
              let grafanaOptionIndex = splitDashboardVar.length > 1 ? Number(splitDashboardVar[splitDashboardVar.length - 1]) : -1;
              // variable name without index
              let grafanaVarName = splitDashboardVar.length > 1 ? splitDashboardVar.slice(0, -1).join("_") : splitDashboardVar[0];
              // get the variable object from the grafana variables list filtering by name
              let grafanaVar = grafanaVariables.filter((v: any) => v.name === grafanaVarName);
              // if the variable is found
              if (grafanaVar.length > 0) {
                // based on the variable type get the value of the option
                if (grafanaVar[0].type === "textbox" || grafanaVar[0].type === "constant") {
                  alias = alias.replace("${" + grafanaVarName + "}", grafanaVar[0].current.value);
                }
                else if (grafanaVar[0].type === "query" || grafanaVar[0].type === "custom") {
                  // get the selected option
                  let option = grafanaVar[0].options[grafanaVar[0].includeAll ? grafanaOptionIndex + 1 : grafanaOptionIndex];
                  // console.log(option);
                  if (option.selected) {
                    alias = alias.replace("${" + grafanaVarName + "_" + grafanaOptionIndex + "}", option.value);
                  }
                }
              }
              // else {
              //   // if the option is not selected, the variable will be discarded
              //   break;
              // }
            }
          }
          else {
            // if the variable id is not found, the variable will be discarded
            break;
          }

          // create the query variable name based on the variable id and the aggregate mode
          queryVarNameList.push(variableId + "_" + aggregateMode);
          // create the field name based on the variable name and the aggregate mode or on the alias
          let fieldName = alias !== ""
            ? alias
            : aggregateMode !== "None"
              ? varName + "_" + aggregateMode
              : varName;
          queryVarIdList.push(variableId);
          queryVarTypeList.push(this.nameTypeMaps[varName]);
          fieldNames.push(fieldName);

          // check the query type (raw, aggregate trend or aggregate) and populate the query object types
          if (aggregateMode === "None" && queryAggregateTime === 0) {
            queryGroups.Data.variablesIdsList.push(variableId);
          } else if (queryAggregateTime !== 0) {
            queryGroups.AggregateTrend.variablesIdsList.push(variableId);
            queryGroups.AggregateTrend.aggregateModesList.push(aggregateMode);
          } else if (["None", "MinMaxTrend", "Gantt", "GanttView", "StepDuration", "ValueChanges"].indexOf(aggregateMode) === -1
            && queryAggregateTime === 0) {
            queryGroups.Aggregate.variablesIdsList.push(variableId);
            queryGroups.Aggregate.aggregateModesList.push(aggregateMode);
          }
        }
      }

      resolve({
        queryGroups: queryGroups,
        queryVarNameList: queryVarNameList,
        queryVarIdList: queryVarIdList,
        queryVarTypeList: queryVarTypeList,
        fieldNames: fieldNames,
      });

    });

  }


  generateWhereClause(queryWhere: MyQueryWhere, queryVarIdList: string[], grafanaVariables: any) {

    return new Promise((resolve, error) => {

      // init an array of checks for each where clause
      let whereClauseActive = [false];

      // loop over the where clause items to check if the where clause is active
      for (let i = 0; i < queryWhere.items.length; i++) {
        let queryWhereItem = queryWhere.items[i];
        // if there is an element1 corresponding to a variable name selected
        if (queryWhereItem.element1 !== "") {
          // if the element2 is not empty could be valid
          if (queryWhereItem.element2 !== "") {
            whereClauseActive[i] = true;
          }
          // check if the element1 name is a grafana variable
          if (queryWhereItem.element1.startsWith("${") && queryWhereItem.element1.endsWith("}")) {
            // from ${varname_1} to varname_1
            let dashboardVar = queryWhereItem.element1.substring(2, queryWhereItem.element1.length - 1);
            // from varname to [varname] or varname_1 to [varname, 1]
            let splitDashboardVar = dashboardVar.split("_");
            // index of the option in the grafana variables list or -1 if no _ is present
            let grafanaOptionIndex = splitDashboardVar.length > 1 ? Number(splitDashboardVar[splitDashboardVar.length - 1]) : 0;
            // console.log("grafanaOptionIndex", grafanaOptionIndex);
            // variable name without index
            let grafanaVarName = splitDashboardVar.length > 1 ? splitDashboardVar.slice(0, -1).join("_") : splitDashboardVar[0];
            // console.log("grafanaVarName", grafanaVarName);
            // get the variable object from the grafana variables list filtering by name
            let grafanaVar = grafanaVariables.filter((v: any) => v.name === grafanaVarName);
            // console.log("grafanaVar", grafanaVar);
            // if the variable is found
            if (grafanaVar.length > 0) {
              // based on the variable type get the value of the option
              if (grafanaVar[0].type === "textbox" || grafanaVar[0].type === "constant") {
                queryWhereItem.element1 = grafanaVar[0].current.value;
                // console.log("queryWhereItem.element1", queryWhereItem.element1);
              }
              else if (grafanaVar[0].type === "query" || grafanaVar[0].type === "custom") {
                // get the selected option
                let option = grafanaVar[0].options[grafanaVar[0].includeAll ? grafanaOptionIndex + 1 : grafanaOptionIndex];
                if (option.selected) {
                  queryWhereItem.element1 = option.value;
                  // console.log("queryWhereItem.element1", queryWhereItem.element1);
                }
              }
            }
            else {
              // if the option is not selected, the where clause will not be used
              whereClauseActive[i] = false;
            }
          }

          // get the variable id from the name of the element1
          queryWhereItem.element1 = this.nameIdMaps[queryWhereItem.element1];
          // check if the element1 id is valid
          if (queryWhereItem.element1 === undefined) {
            whereClauseActive[i] = false;
          }

          // check if the element2 name is a grafana variable
          let element2IndexStart = queryWhereItem.element2.indexOf("${");
          let element2IndexEnd = queryWhereItem.element2.indexOf("}");
          if (element2IndexStart !== -1 && element2IndexEnd !== -1) {
            // from el2_${varname_1}_chart to varname_1
            let dashboardVar = queryWhereItem.element2.substring(element2IndexStart + 2, element2IndexEnd);
            // from varname to [varname] or varname_1 to [varname, 1]
            let splitDashboardVar = dashboardVar.split("_");
            // index of the option in the grafana variables list or -1 if no _ is present
            let grafanaOptionIndex = splitDashboardVar.length > 1 ? Number(splitDashboardVar[splitDashboardVar.length - 1]) : 0;
            // console.log("grafanaOptionIndex", grafanaOptionIndex);
            // variable name without index
            let grafanaVarName = splitDashboardVar.length > 1 ? splitDashboardVar.slice(0, -1).join("_") : splitDashboardVar[0];
            // console.log("grafanaVarName", grafanaVarName);
            // get the variable object from the grafana variables list filtering by name
            let grafanaVar = grafanaVariables.filter((v: any) => v.name === grafanaVarName);
            // console.log("grafanaVar", grafanaVar);
            // if the variable is found
            if (grafanaVar.length > 0) {
              // based on the variable type get the value of the option
              if (grafanaVar[0].type === "textbox" || grafanaVar[0].type === "constant") {
                queryWhereItem.element2 = queryWhereItem.element2.replace("${" + grafanaVarName + "}", grafanaVar[0].current.value);
                // console.log("queryWhereItem.element2", queryWhereItem.element2);
              }
              else if (grafanaVar[0].type === "query" || grafanaVar[0].type === "custom") {
                // get the selected option
                let option = grafanaVar[0].options[grafanaVar[0].includeAll ? grafanaOptionIndex + 1 : grafanaOptionIndex];
                if (option.selected) {
                  queryWhereItem.element2 = queryWhereItem.element2.replace("${" + grafanaVarName + "_" + grafanaOptionIndex + "}", option.value);
                  // console.log("queryWhereItem.element2", queryWhereItem.element2);
                }
                else {
                  // if the option is not selected, the where clause will not be used
                  whereClauseActive[i] = false;
                }
              }
            }
          }

          // but if the element 1 is not in the requested variables list, the where clause will not be used
          if (queryVarIdList.indexOf(queryWhereItem.element1) === -1) {
            whereClauseActive[i] = false;
          }
        }
      }

      // check if all the where clause items are true
      let whereClauseActiveCheck = whereClauseActive.every((check) => check === true);
      // console.log("whereClauseActive", whereClauseActive);
      // console.log("queryWhere", queryWhere);

      resolve({
        whereClauseActiveCheck: whereClauseActiveCheck,
        whereClauseActive: whereClauseActive,
        queryWhere: queryWhere
      });

    });

  }


  formatQueryResult(
    fields: any[],
    queryFinish: any,
    queryVarNameList: string[],
    queryVarIdList: string[],
    queryVarTypeList: string[],
    queryOrder: string,
    queryGroups: QueryGroupObject,
    whereClauseActiveCheck: boolean,
    whereClauseActive: boolean[],
    queryWhere: MyQueryWhere,
    fieldNames: string[]) {

    return new Promise((resolve, error) => {

      // after loop is finished
      if (queryFinish) {
        // init a time buffer for time ordered data and one for where filtered data
        let timeBuf: number[] = [];
        let filteredTimeBuf: number[] = [];
        // init a data buffer for time ordered data and one for where filtered data
        let dataBuf: any = {};
        let filteredDataBuf: any = {};
        // create the data buffer for each variable
        queryVarNameList.map((name: string) => {
          dataBuf[name] = []
          filteredDataBuf[name] = []
        });


        // create an array that contains the indexes of the timestamps buffer
        let orderedIndexes = Array.from({ length: queryFinish.timeBuffer.length }, (_, index) => index);
        if (queryOrder === "Ascending") {
          // sort indexes based on timestamps buffer ascending
          orderedIndexes = orderedIndexes.sort((a, b) => +new Date(queryFinish.timeBuffer[a]) - +new Date(queryFinish.timeBuffer[b]));
        } else {
          //sort indexes based on timestamps buffer descending
          orderedIndexes = orderedIndexes.sort((a, b) => +new Date(queryFinish.timeBuffer[b]) - +new Date(queryFinish.timeBuffer[a]));
        }

        // create the timestamps buffer ordered by the previous indexes array
        timeBuf = orderedIndexes.map((idx) => queryFinish.timeBuffer[idx]);
        // loop over the query variables names list and push the data in the ordered data buffer
        for (let j = 0; j < queryVarNameList.length; j++) {
          dataBuf[queryVarNameList[j]] = orderedIndexes.map((idx) => queryFinish.dataBuffer[queryVarNameList[j]][idx]);
        }

        // check if where clause has to be applied
        if (whereClauseActiveCheck) {
          // this array retain the previous where condition
          let oldWhereConditions: boolean[] = [];

          // an array that contain all variables from aggregate mode list used in the where clause
          let aggregateModeWhereIds = queryWhere.items
            .filter((item: any, idx) => whereClauseActive[idx] && queryGroups.Aggregate.variablesIdsList.includes(item.element1))
            .map((item: any) => item.element1);
          // the corresponding values of the variables from aggregate mode list used in the where clause
          let aggregateModeWhereValues = aggregateModeWhereIds
            .map((el: any) => queryVarIdList.indexOf(el))
            .map((index: any) => dataBuf[queryVarNameList[index]][dataBuf[queryVarNameList[index]].length - 1]);
          // console.log("aggregateModeWhereIds", aggregateModeWhereIds);
          // console.log("aggregateModeWhereValues", aggregateModeWhereValues);

          for (let i = 0; i < timeBuf.length; i++) {
            // console.log("timeBuf[i]", timeBuf[i]);
            // console.log("oldWhereConditions", oldWhereConditions);
            // init an array where each element is the result of each where clause item
            let whereConditions: boolean[] = [];
            // loop over the where clause items
            for (let j = 0; j < queryWhere.items.length; j++) {
              if (whereClauseActive[j]) {
                // init the where condition as false
                whereConditions[j] = false;
                // get the index of the variable id requested in the where clause
                let index = queryVarIdList.indexOf(queryWhere.items[j].element1);
                // if the variable id is found apply the where clause
                if (index !== -1) {
                  // get the value of the variable in the data buffer
                  let value = dataBuf[queryVarNameList[index]][i];
                  // console.log("value", value);
                  // get the index of the variable id in the aggregate mode list (if present)
                  let indexInAggregateModeWhereIds = aggregateModeWhereIds.indexOf(queryWhere.items[j].element1);
                  // set the value as the last value of the variable in the data buffer
                  // since aggregate mode variables has only one value
                  // and the where clause contains a variable from aggregate mode list
                  // we will find all undefined values in the data buffer until the last value
                  // in this case if we are querying also the raw data mode no data will be returned
                  // since the where clause is not satisfied untile last row
                  if (value === undefined && indexInAggregateModeWhereIds !== -1) {
                    value = aggregateModeWhereValues[indexInAggregateModeWhereIds];
                  }
                  // if the value is undefined and the previous where condition was true, the new condition is true
                  // this mainly done in case we have a variable as raw and a variable as aggregate where the condition is applied
                  // to the raw variable and the timestamps are not aligned, so the raw variable will have undefined values
                  // when the aggregate variable has values
                  // with this if we say to maintain the previous condition if the new value is undefined
                  if (value === undefined && oldWhereConditions[j] === true) {
                    whereConditions[j] = true;
                  }
                  // if the value is undefined and is the last line of the data buffer, the new condition is true
                  // this is done to maintain the last line of the data buffer if the where clause is not satisfied
                  else if (value === undefined && i === timeBuf.length - 1) {
                    whereConditions[j] = true;
                  }
                  else {
                    // apply the where to value [comparator] element2
                    whereConditions[j] = this.applyWhereClause(
                      value,
                      queryWhere.items[j].comparator,
                      queryWhere.items[j].element2,
                    );
                  }
                }
                // console.log("whereConditions", whereConditions);
                // save the previous where condition
                oldWhereConditions = whereConditions;
              }
            }
            // take the first where condition as the result
            let whereResult = whereConditions[0];
            // loop over the where conditions and apply the operator to the result and the next condition
            for (let j = 1; j < whereConditions.length; j++) {
              // apply the operator to the result and the next condition
              whereResult =
                queryWhere.operators[j] === "and"
                  ? whereResult && whereConditions[j]
                  : whereResult || whereConditions[j];
            }
            // console.log("whereResult", whereResult);
            // if the where result is true or is the last line insert the timestamp and the data in the filtered buffers
            if (whereResult || i === timeBuf.length - 1) {
              // console.log("aggregateModeVarInWhere", i === timeBuf.length - 1, queryGroups.Aggregate.variablesIdsList.length > 0
              //   , queryGroups.Data.variablesIdsList.length > 0, aggregateModeWhereIds.length === 0);c

              // if simply result of where is true
              if (whereResult) {
                // push the timestamp in the filtered buffer
                filteredTimeBuf.push(timeBuf[i]);
                // loop over the query variables names list and push the data in the filtered buffer
                for (let j = 0; j < queryVarNameList.length; j++) {
                  filteredDataBuf[queryVarNameList[j]].push(dataBuf[queryVarNameList[j]][i]);
                }
              }
              // if the where result is false, is the last line, the aggregate mode was used and also the raw data mode is used
              else if (i === timeBuf.length - 1
                && queryGroups.Aggregate.variablesIdsList.length > 0
                && queryGroups.Data.variablesIdsList.length > 0) {
                // check if the where clause is satisfied for the aggregate mode variables
                // or if we don't have any aggregate mode variable in the where clause
                if (aggregateModeWhereIds.map((id: any) =>
                  whereConditions[queryWhere.items.map((item: any) => item.element1).indexOf(id)]).includes(true)
                  || aggregateModeWhereIds.length === 0) {
                  // console.log("timeBuf[i]", timeBuf[i]);
                  // console.log("data", dataBuf[queryVarNameList[0]][i], dataBuf[queryVarNameList[1]][i]);
                  // push the timestamp in the filtered buffer
                  filteredTimeBuf.push(timeBuf[i]);
                  // loop over the query variables names list and push the data in the filtered buffer
                  for (let j = 0; j < queryVarNameList.length; j++) {
                    //console.log(dataBuf[queryVarNameList[j]][i])
                    // only the variables in aggregate mode list are pushed since the other not satisfy the where clause
                    if (queryGroups.Aggregate.variablesIdsList.includes(queryVarIdList[j])) {
                      // check if the where clause is satisfied for the aggregate mode variables
                      // or if we don't have any aggregate mode variable in the where clause
                      if (whereConditions[queryWhere.items.map((item: any) => item.element1).indexOf(queryVarIdList[j])]
                        || aggregateModeWhereIds.length === 0) {
                        // push the data in the filtered buffer
                        filteredDataBuf[queryVarNameList[j]].push(dataBuf[queryVarNameList[j]][i]);
                      }
                    }
                  }
                }
              }
            }
          }
        }
        else {
          // if where clause is not active, the filtered buffers are equal to the ordered buffers
          filteredDataBuf = dataBuf;
          filteredTimeBuf = timeBuf;
        }
        // console.log("filteredTimeBuf", filteredTimeBuf);
        // console.log("filteredDataBuf", filteredDataBuf);

        // insert time in fields using as values the time buffer array ordered by the previous indexes array
        fields[0] = { name: "Time", type: FieldType.time, values: filteredTimeBuf };
        // loop over the query variables names list and push the data in the ordered data buffer
        for (let i = 0; i < queryVarNameList.length; i++) {
          // push it to result fields
          fields.push({
            name: fieldNames[i],
            type: queryVarTypeList[i] === "String" ? FieldType.string : FieldType.number,
            values: filteredDataBuf[queryVarNameList[i]],
          });
        }
      }

      // resolve the result
      resolve({
        fields: fields
      });

    });

  }


  async metricFindQuery(query: MyVariableQuery, options?: any) {
    //console.log("metricFindQuery", query);
    //console.log("options", options);

    // init grafana response fields
    let values: any[] = [];

    // check token based on version
    let tokenCheck = false;

    if (this.isRemote) {
      // if IED token has expired or empty renew it
      if (new Date().getTime() > this.remoteTokenExpire || this.remoteToken === "") {
        await this.getRemoteToken();
        await this.createAssetMap();
        await this.createVariablesMap();
        await this.createVariablesOptions();
        // await this.createVariablesOptionsCascader();
      }
      // if IED token exist pass check
      if (this.remoteToken !== "") {
        tokenCheck = true;
      }
    }
    else {
      // if is local no need for IED token
      tokenCheck = true;
    }

    // if previous check of token was successful
    if (tokenCheck) {
      //this.start = new Date().getTime();

      // if grafana variables are used in variablesnames field, replace them
      let varNamesList = query.variablesNamesList || [];
      // console.log("varNamesList", varNamesList);
      // if grafana variables are used in from and to fields, replace them
      let from = getTemplateSrv().replace(query.from, options.scopedVars);
      let to = getTemplateSrv().replace(query.to, options.scopedVars);
      // console.log("from", from);
      // console.log("to", to);
      // get the requested order mode
      let queryOrder = query.order === "Descending" ? "Descending" : "Ascending";
      // get the list of aliases
      let aliasesList = query.aliasesList;
      // get the requested aggregation mode list
      let queryAggregateModes = query.aggregateModesList;
      // get the aggregate time in ms
      let queryAggregateTime = this.aggregateTimeMap[query.aggregateTime];
      // get the query where clause
      let queryWhere = query.where || { items: [], operators: [] };
      // console.log("queryWhere", queryWhere);

      // get the grafana variables
      let grafanaVariables = getTemplateSrv().getVariables() as any;
      // console.log("grafanaVariables", grafanaVariables);

      // generate query groups, some lists with variables properties and the field names
      let fvRes: any = await this.createQueryProperties(
        varNamesList,
        grafanaVariables,
        queryAggregateModes,
        queryAggregateTime,
        aliasesList);
      let queryGroups = fvRes.queryGroups;
      let queryVarNameList = fvRes.queryVarNameList;
      let queryVarIdList = fvRes.queryVarIdList;
      let queryVarTypeList = fvRes.queryVarTypeList;
      let fieldNames = fvRes.fieldNames;
      // console.log(queryVarNameList);
      // console.log(fieldNames);
      // console.log(queryGroups);
      // console.log("queryWhere", queryWhere);
      // based on the query configuration generate the where clause for the query
      let gwcRes: any = await this.generateWhereClause(queryWhere, queryVarIdList, grafanaVariables);
      let whereClauseActiveCheck = gwcRes.whereClauseActiveCheck;
      let whereClauseActive = gwcRes.whereClauseActive;
      queryWhere = gwcRes.queryWhere;
      // console.log("queryWhere", queryWhere);

      // check if the from and to are valid and if there is some field to query
      if (
        new Date(from).getTime() > 0
        && new Date(to).getTime() > 0
        && new Date(from).getTime() < new Date(to).getTime()
        && fieldNames.length > 0
      ) {
        // format dates to ISO string for the query
        from = new Date(from).toISOString();
        // if to is greater than now, set it to now
        to = new Date(to).getTime() > new Date().getTime() ? new Date().toISOString() : new Date(to).toISOString();

        // reset the buffers
        let dataBuffer: any = {};
        queryVarNameList.map((name: string) => (dataBuffer[name] = []));
        let timeBuffer: string[] = [];

        // start the query
        const queryFinish = await this.queryLoop(
          timeBuffer,
          dataBuffer,
          queryGroups,
          from,
          to,
          queryOrder,
          queryAggregateTime
        );
        // console.log(timeBuffer);
        // console.log(dataBuffer);

        // based on the data received format them to create the grafana fields to be sent to page
        let fqRes: any = await this.formatQueryResult(
          values,
          queryFinish,
          queryVarNameList,
          queryVarIdList,
          queryVarTypeList,
          queryOrder,
          queryGroups,
          whereClauseActiveCheck,
          whereClauseActive,
          queryWhere,
          fieldNames
        );

        // console.log("fqRes", fqRes.fields[1]);
        // format the only field available in the response as a list of values
        values = fqRes.fields[1].values.map((value: any) => { return { text: value } });
        // console.log("values", values);
      }
    }

    return values;
  }


  async customRequest(url: string,
    headers: object,
    method: string,
    body: object,
    resType: AllowedRequestType = "json",
    params?: string): Promise<any> {
    // a custom implementation of the grafana HTTP request that handle all methods than GET
    const requestHeaders = {
      ...this.headers,
      ...headers,
    };
    // console.log("customrequest", this.baseUrl, requestHeaders);
    if (method !== "get") {
      let observableResponse = getBackendSrv().fetch({
        url: `${url}${params?.length ? `?${params}` : ""}`,
        headers: requestHeaders,
        method: method,
        data: body,
        responseType: resType
      });
      return lastValueFrom(observableResponse);

    } else {
      // if method is get call the custom get request
      return this.customGetRequest(url, headers, resType, params);
    }
  }


  async customGetRequest(url: string,
    headers: object,
    resType: AllowedRequestType = "json",
    params = ""): Promise<any> {
    // a custom implementation of the grafana HTTP request that handle GET API calls
    const requestHeaders = {
      ...this.headers,
      ...headers,
    };
    //url: `${this.baseUrl}${url}${params?.length ? `?${params}` : ""}`,
    let observableResponse = getBackendSrv().fetch({
      url: `${url}${params?.length ? `?${params}` : ""}`,
      headers: requestHeaders,
      method: "get",
      responseType: resType
    });

    return lastValueFrom(observableResponse);
  }


  delay(t: number) {
    // a dynamic delay function
    return new Promise((resolve) => setTimeout(resolve, t));
  }


  async testDatasource() {
    // Called by Save&Test in Datasource config, Checks whether we can connect to the API
    let defaultErrorMessage = "Cannot connect to local IIH Essentials, check if the app is running.";

    try {

      // console.log("testDatasource", this);

      let url = "";
      let headers = {};

      if (this.isRemote) {
        // set remote url for join as test
        url = this.apiUrl + "/iih-essentials";
        // check remote token
        if (this.remoteToken === "") {
          await this.getRemoteToken();
        }
        // if remote set remote ied token
        //headers = { Cookie: "authToken=" + this.remoteToken };
        headers = {
          "x-grafana-remotedevice": this.remoteConfigUrl,
          "x-grafana-remotetoken": this.remoteToken
        };
      }
      else {
        url = this.apiUrl;
      }

      // send request
      const response = await this.customGetRequest(url, headers, "text");

      // console.log("test datasource response:", response);
      if (response.status === 200) {
        return {
          status: "success",
          message: "Success",
        };
      } else {
        return {
          status: "error",
          message: response.statusText ? response.statusText : defaultErrorMessage,
        };
      }


    } catch (err: any) {

      if (_.isString(err)) {
        return {
          status: "error",
          message: err,
        };
      } else {
        let message = "";
        message += err.statusText ? err.statusText : defaultErrorMessage;
        console.log("testdatasource error:", err);

        return {
          status: "error",
          message,
        };
      }

    }
  }


}
