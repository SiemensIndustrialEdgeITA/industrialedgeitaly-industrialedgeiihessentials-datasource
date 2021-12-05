import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  FieldType,
  MutableDataFrame,
  SelectableValue,
} from '@grafana/data';
import { getBackendSrv, getTemplateSrv } from '@grafana/runtime';
import _ from 'lodash';
import defaults from 'lodash/defaults';
import { defaultQuery, MyDataSourceOptions, MyQuery } from './types';

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  baseUrl: string;
  accessToken: string;
  accessExpire: number;
  headers: object;
  userAPI: string;
  passAPI: string;
  createUserBody: object;
  requestTokenBody: object;
  nameIdMaps: any;
  idNameMaps: any;
  idAssetMaps: any;
  variablesOptions: Array<SelectableValue<string>>;
  aggregateBaseBody: any;
  aggregateTimeMap: any;
  start: number;

  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
    // get url of dataservice app from the configeditor
    this.baseUrl = instanceSettings.url!;
    // init base headers
    this.headers = { 'Content-Type': 'application/json' };
    // init properties for token request to dataservice
    this.accessToken = '';
    this.accessExpire = 0;
    this.requestTokenBody = {
      appName: 'edgeappdataservice',
      appVersion: '1.1',
      hostTenant: 'edge',
      userTenant: 'edge',
    };
    // init properties for user creation in dataservice
    this.userAPI = 'grafanaUser';
    this.passAPI = 'grafanaPass';
    this.createUserBody = {
      userName: this.userAPI,
      passWord: this.passAPI,
      familyName: 'grafanaFamily',
      givenName: 'grafanaName',
      email: 'grafana@example.com',
      roles: [
        {
          application: 'edgeappdataservice',
          role: 'admin',
        },
      ],
    };
    // init base body message for aggregates requests to dataservice
    this.aggregateBaseBody = {
      from: '',
      to: '',
      dataSources: [],
      variableConfigurations: [
        {
          unit: 'string',
          isAggregated: true,
          acquisitionCategory: 'ProcessValue',
          acquisitionCycle: {
            base: 'acyclic',
            factor: 0,
          },
          counterConfigurations: [
            {
              validFrom: '2019-06-25T00:00:00.000Z',
              counterConstant: 1,
              counterType: 'UpCounter',
              triggeredReset: false,
              rangeStart: 0,
              rangeEnd: 1000,
              valueAtInstallation: null,
              valueAtReplacement: null,
            },
          ],
          limitsConfiguration: {
            isRawData: false,
            aggregation: 'None',
            calculationCycle: {
              base: 'second',
              factor: 1,
            },
            limits: {
              high_alert: {
                threshold: 0,
                activateNotification: false,
                notificationConfigId: '',
              },
              high_warning: {
                threshold: 0,
                activateNotification: false,
                notificationConfigId: '',
              },
              low_alert: {
                threshold: 0,
                activateNotification: false,
                notificationConfigId: '',
              },
              low_warning: {
                threshold: 0,
                activateNotification: false,
                notificationConfigId: '',
              },
            },
          },
        },
      ],
    };
    // init map for aggregate time range mapping in milliseconds
    this.aggregateTimeMap = {
      None: 0,
      '1m': 60000,
      '5m': 300000,
      '10m': 600000,
      '30m': 1800000,
      '1h': 3600000,
      '12h': 43200000,
      '1d': 86400000,
    };
    // init maps for variables id to name and name to id
    this.nameIdMaps = {};
    this.idNameMaps = {};
    // init map for assets id to name
    this.idAssetMaps = {};
    // init variables options for query editor select
    this.variablesOptions = [];

    // init start time for query performance calculation
    this.start = 0;

    // call function to init token, assets, variables
    this.initPlugin();
  }

  async initPlugin() {
    try {
      // get access token
      await this.getToken();
      // get assets and create id name map
      await this.createAssetMap();
      // get variables and create id name maps
      await this.createVariablesMap();
    } catch (error) {
      console.log('initPlugin error', error);
    }
  }

  getToken() {
    // call user creation API, then call create token API and update token props
    var self = this;

    return new Promise<boolean>((resolve, error) => {
      // get actual users
      self.customGetRequest('/TokenManagerService/users', {}, '').then(
        (res) => {
          // check if user exists
          let grafanaUser = res.data.filter((user: any) => user.userName === this.userAPI);
          if (grafanaUser.length === 0) {
            // try to create a user
            self.customRequest('/TokenManagerService/users', {}, 'post', self.createUserBody, '').then(
              (res) => {
                // if user is created, ask for token using user credentials hashed
                const basicAuthHeader = { 'X-SPACE-AUTH-KEY': 'Basic ' + btoa(self.userAPI + ':' + self.passAPI) };
                self
                  .customRequest('/TokenManagerService/oauth/token', basicAuthHeader, 'post', self.requestTokenBody, '')
                  .then(
                    (res) => {
                      // save access token
                      self.accessToken = res.data.access_token;
                      // save next expire timestamp
                      self.accessExpire = (Math.floor(new Date().getTime() / 1000) + res.data.expires_in) * 1000;
                      resolve(true);
                    },
                    (err) => {
                      console.log(err);
                      error(err);
                    }
                  );
              },
              (err) => {
                console.log(err);
                error(err);
              }
            );
          } else {
            // if user is created, ask for token using user credentials hashed
            const basicAuthHeader = { 'X-SPACE-AUTH-KEY': 'Basic ' + btoa(self.userAPI + ':' + self.passAPI) };
            self
              .customRequest('/TokenManagerService/oauth/token', basicAuthHeader, 'post', self.requestTokenBody, '')
              .then(
                (res) => {
                  // save access token
                  self.accessToken = res.data.access_token;
                  // save next expire timestamp
                  self.accessExpire = (Math.floor(new Date().getTime() / 1000) + res.data.expires_in - 120) * 1000;
                  resolve(true);
                },
                (err) => {
                  console.log(err);
                  error(err);
                }
              );
          }
        },
        (err) => {
          console.log(err);
          error(err);
        }
      );
    });
  }

  createAssetMap() {
    // call get assets API and create id name map

    // check if access token is available
    if (this.accessToken === '') {
      this.getToken().then(
        (res) => {
          //console.log(res);
        },
        (err) => {
          console.log(err);
        }
      );
    }

    var self = this;

    return new Promise<boolean>((resolve, error) => {
      // make request for variables list
      self.customGetRequest('/AssetService/Assets', { Authorization: self.accessToken }, '').then(
        (res: any) => {
          // check if assets are available
          if (res.data.hasOwnProperty('assets')) {
            // loop over assets array
            for (let i = 0; i < res.data.assets.length; i++) {
              //create map properties as assetId: assetName
              self.idAssetMaps[res.data.assets[i].assetId] = res.data.assets[i].name;
            }
            resolve(true);
          } else {
            console.log('No assets.');
            resolve(false);
          }
        },
        (err) => {
          console.log(err);
          error(false);
        }
      );
    });
  }

  createVariablesMap() {
    // call get variables API and create id name and name id maps

    // check if access token is available
    if (this.accessToken === '') {
      this.getToken().then(
        (res) => {
          //console.log(res);
        },
        (err) => {
          console.log(err);
        }
      );
    }

    var self = this;

    return new Promise<boolean>((resolve, error) => {
      // make request for variables list
      self.customGetRequest('/DataService/Variables', { Authorization: self.accessToken }, '').then(
        (res: any) => {
          // check if variables are available
          if (res.data.hasOwnProperty('variables')) {
            // loop over variables array
            for (let i = 0; i < res.data.variables.length; i++) {
              //create map properties as "varName": varId
              let varName = this.idAssetMaps[res.data.variables[i].assetId] + '.' + res.data.variables[i].variableName;
              self.nameIdMaps[varName] = res.data.variables[i].variableId;
              self.idNameMaps[res.data.variables[i].variableId] = varName;
            }
            resolve(true);
          } else {
            console.log('No variables.');
            resolve(false);
          }
        },
        (err) => {
          console.log(err);
          error(false);
        }
      );
    });
  }

  createVariablesOptions() {
    // call get variables API and create options list for multiselect in the UI

    // check if access token is available
    if (this.accessToken === '') {
      this.getToken().then(
        (res) => {
          //console.log(res);
        },
        (err) => {
          console.log(err);
        }
      );
    }
    var self = this;

    // reset options
    self.variablesOptions = [];

    return new Promise<Array<SelectableValue<string>>>((resolve, error) => {
      // request var list
      self.customGetRequest('/DataService/Variables', { Authorization: self.accessToken }, '').then(
        (res: any) => {
          // check if variables are available
          if (res.data.hasOwnProperty('variables')) {
            // loop over variables array
            for (let i = 0; i < res.data.variables.length; i++) {
              let varName = this.idAssetMaps[res.data.variables[i].assetId] + '.' + res.data.variables[i].variableName;
              // create option
              self.variablesOptions.push({
                label: varName,
                value: varName,
              });
            }
            // order ascending options list
            self.variablesOptions.sort((a, b) =>
              typeof a.value === 'string' && typeof b.value === 'string' ? a.value.localeCompare(b.value) : 0
            );
            resolve(self.variablesOptions);
          } else {
            console.log('No variables.');
            resolve([]);
          }
        },
        (err) => {
          console.log(err);
          error(false);
        }
      );
    });
  }

  queryData(timeBuffer: string[], dataBuffer: any, ids: string, from: string, to: string, order: string) {
    // call get raw data API, extract data to temp fields and update main buffer data

    // copy main class for nested functions
    var self = this;

    return new Promise((resolve, error) => {
      // init timestamps
      let timestamps: any[] = [];
      let fieldsValues: any = {};

      // create query string for dataservice
      const queryParams = `variableIds=${ids}&from=${from}&to=${to}&order=${order}`;

      // start request
      self.customGetRequest('/DataService/Data', { Authorization: self.accessToken }, queryParams).then(
        (res: any) => {
          // get datapoints array from response
          let datapoints = res.data.data;
          // init time index used for all buffers arrays
          let tIndex = -1;
          //console.log(res.data);
          // loop over datapoints
          for (let i = 0; i < datapoints.length; i++) {
            // init an array for temporary values of the current call
            fieldsValues[datapoints[i].variableId] = new Array(2000 * datapoints.length).fill(null);

            // loop over values of the current datapoint
            for (let j = 0; j < datapoints[i].values.length; j++) {
              // search for the timestamp in the temporary timestamps buffer, if not found add it and save the index
              tIndex = timestamps.indexOf(datapoints[i].values[j].timestamp);
              if (tIndex === -1) {
                timestamps.push(datapoints[i].values[j].timestamp);
                timeBuffer.push(datapoints[i].values[j].timestamp);
                tIndex = timestamps.length - 1;
              }
              // save the value in the temporary array in the same position of the timestamp
              fieldsValues[datapoints[i].variableId][tIndex] = datapoints[i].values[j].value;
            }
          }
          //console.log(fieldsValues);

          // finalize temporary arrays by cutting the excess based on the timestamps buffer length and concat them to main variables buffers
          for (let k = 0; k < datapoints.length; k++) {
            dataBuffer[datapoints[k].variableId] = dataBuffer[datapoints[k].variableId].concat(
              fieldsValues[datapoints[k].variableId].slice(0, timestamps.length)
            );
          }

          if (!res.data.hasOwnProperty('hasMoreData')) {
            //console.log('finish');
            resolve({
              queryFinished: true,
              queryFrom: '',
              queryTo: '',
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
        (err) => {
          console.log(err);
          error(false);
        }
      );
    });
  }

  queryDataAggregateTrend(
    timeBuffer: string[],
    dataBuffer: any,
    ids: string,
    from: string,
    to: string,
    aggregateMode: string,
    aggregateTime: number
  ) {
    // call get aggregate trend data API, extract data to temp fields and update main buffer data

    // copy main class for nested functions
    var self = this;

    return new Promise((resolve, error) => {
      // init timestamps
      let timestamps: any[] = [];
      let fieldsValues: any = {};

      // create query body
      const aggregateBody = {
        ...this.aggregateBaseBody,
        from: from,
        to: to,
        calculationTimeRange: aggregateTime,
        dataSources: [],
      };
      // push variables to query body by using ids string
      ids
        .replace(/"/g, '')
        .replace('[', '')
        .replace(']', '')
        .split(',')
        .forEach((id) => {
          aggregateBody.dataSources.push({
            type: 'Variable',
            id: id,
            aggregation: aggregateMode,
          });
        });

      // start request
      self
        .customRequest('/DataService/CalculateTrend', { Authorization: self.accessToken }, 'post', aggregateBody, '')
        .then(
          (res: any) => {
            // get datapoints array from response
            let datapoints = res.data;

            // init time index used for all buffers arrays
            let tIndex = -1;
            //console.log(res.data);
            // loop over datapoints
            for (let i = 0; i < datapoints.length; i++) {
              // init an array for temporary values of the current call
              fieldsValues[datapoints[i].dataSource.id] = new Array(2000 * datapoints.length).fill(null);

              // loop over values of the current datapoint
              for (let j = 0; j < datapoints[i].values.length; j++) {
                // search for the timestamp in the temporary timestamps buffer, if not found add it and save the index
                tIndex = timestamps.indexOf(datapoints[i].values[j].timestamp);
                if (tIndex === -1) {
                  timestamps.push(datapoints[i].values[j].timestamp);
                  timeBuffer.push(datapoints[i].values[j].timestamp);
                  tIndex = timestamps.length - 1;
                }
                // save the value in the temporary array in the same position of the timestamp
                fieldsValues[datapoints[i].dataSource.id][tIndex] = datapoints[i].values[j].value;
              }
            }
            //console.log(fieldsValues);

            // finalize temporary arrays by cutting the excess based on the timestamps buffer length and concat them to main variables buffers
            for (let k = 0; k < datapoints.length; k++) {
              dataBuffer[datapoints[k].dataSource.id] = dataBuffer[datapoints[k].dataSource.id].concat(
                fieldsValues[datapoints[k].dataSource.id].slice(0, timestamps.length)
              );
            }

            if (!res.data.hasOwnProperty('hasMoreData')) {
              //console.log('finish');
              resolve({
                queryFinished: true,
                queryFrom: '',
                queryTo: '',
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
          (err) => {
            console.log(err);
            error(false);
          }
        );
    });
  }

  queryDataAggregate(
    timeBuffer: string[],
    dataBuffer: any,
    ids: string,
    from: string,
    to: string,
    aggregateMode: string
  ) {
    // call get aggregate data API, extract data to temp fields and update main buffer data
    // this API return only 1 value!

    // copy main class for nested functions
    var self = this;

    return new Promise((resolve, error) => {
      // create query body
      const aggregateBody = {
        ...this.aggregateBaseBody,
        from: from,
        to: to,
        dataSources: [],
      };
      // push variables to query body by using ids string
      ids
        .replace(/"/g, '')
        .replace('[', '')
        .replace(']', '')
        .split(',')
        .forEach((id) => {
          aggregateBody.dataSources.push({
            type: 'Variable',
            id: id,
            aggregation: aggregateMode,
          });
        });

      // start request
      self.customRequest('/DataService/Calculate', { Authorization: self.accessToken }, 'post', aggregateBody, '').then(
        (res: any) => {
          // get datapoints array from response
          let datapoints = res.data;
          //console.log(res.data);

          // init time index used for all buffers arrays
          let tIndex = -1;
          // loop over datapoints
          for (let i = 0; i < datapoints.length; i++) {
            // init an array for temporary values of the current call
            dataBuffer[datapoints[i].dataSource.id] = [datapoints[i].value];
            tIndex = timeBuffer.indexOf(to);
            if (tIndex === -1) {
              timeBuffer.push(to);
            }
          }

          // only one value will be returned, so we can finish the query
          resolve({ queryFinished: true, timeBuffer: timeBuffer, dataBuffer: dataBuffer });
        },
        (err) => {
          console.log(err);
          error(false);
        }
      );
    });
  }

  delay(t: number) {
    // a dynamic delay function
    return new Promise((resolve) => setTimeout(resolve, t));
  }

  async queryLoop(
    timeBuffer: string[],
    dataBuffer: any,
    ids: string,
    from: string,
    to: string,
    order: string,
    aliases: string[],
    aggregateMode: string,
    aggregateTime: number
  ) {
    // this function handle multiple queries till the results are all available based on dataservice responses

    // initialize loop properties
    let queryFinished = false;
    let queryFrom = from;
    let queryTo = to;
    let tBuf = timeBuffer;
    let dBuf = dataBuffer;

    // a for loop that handle multiple data requests
    for (var i = 1; !queryFinished && i < 10000; i++) {
      // delay needed to avoid too requests overlapping
      await this.delay(200);

      // check the query type (raw, aggregate trend or aggregate)
      if (aggregateMode === 'None' && aggregateTime === 0) {
        // run raw data query
        this.queryData(tBuf, dBuf, ids, queryFrom, queryTo, order)
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
          .catch((err) => console.log(err));
      } else if (aggregateTime !== 0) {
        // run aggregate trend query
        this.queryDataAggregateTrend(tBuf, dBuf, ids, queryFrom, queryTo, aggregateMode, aggregateTime)
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
          .catch((err) => console.log(err));
      } else {
        // run aggregate query
        this.queryDataAggregate(tBuf, dBuf, ids, queryFrom, queryTo, aggregateMode)
          .then((res: any) => {
            // update buffers
            tBuf = res.timeBuffer;
            dBuf = res.dataBuffer;

            if (res.queryFinished) {
              queryFinished = true;
            }
          })
          .catch((err) => console.log(err));
      }
    }

    return { timeBuffer: tBuf, dataBuffer: dBuf };
  }

  async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
    // the query method for Grafana
    const promises = options.targets.map(async (target) => {
      const query: any = defaults(target, defaultQuery);

      // init grafana response fields
      let fields: any[] = [];

      // if token has expired or empty renew it
      if (new Date().getTime() > this.accessExpire || this.accessToken === '') {
        await this.getToken();
        await this.createAssetMap();
        await this.createVariablesMap();
        await this.createVariablesOptions();
      }

      // check if access token exists
      if (this.accessToken !== '') {
        //this.start = new Date().getTime();

        // if grafana variables are used in variablesnames field, replace them
        let varNames = getTemplateSrv().replace(query.variablesNames, options.scopedVars, 'csv');
        // if grafana variables are used in from and to fields, replace them
        let from = getTemplateSrv().replace(query.from, options.scopedVars);
        let to = getTemplateSrv().replace(query.to, options.scopedVars);

        // get the requested order mode
        let queryOrder = query.order === 'Descending' ? 'Descending' : 'Ascending';
        let queryAliases =
          query.aliases !== '' ? getTemplateSrv().replace(query.aliases, options.scopedVars, 'csv').split(',') : [];
        // get the requested aggregation mode & period
        let queryAggregateMode = query.aggregateMode;
        let queryAggregateTime = this.aggregateTimeMap[query.aggregateTime];

        // get var name from query string
        let variablesNames: string[] = [];
        // ensure that no spaces are in the variable names between commas
        const spaceCommaRegex = new RegExp(' , | ,|, ', 'g');
        let namesOk = false;
        while (!namesOk) {
          if (spaceCommaRegex.test(varNames)) {
            varNames = varNames.replace(/ , | ,|, /g, ',');
          } else {
            namesOk = true;
            variablesNames = varNames.split(',');
          }
        }
        //console.log(variablesNames);

        // get id from names based on nameid map
        let variablesIdsArray = variablesNames.map((x: string) => this.nameIdMaps[x]);

        // check if the variables ids are valid and if the from and to are valid
        if (
          variablesNames.indexOf('') === -1 &&
          variablesIdsArray.length > 0 &&
          variablesIdsArray.indexOf(undefined) === -1 &&
          variablesIdsArray.indexOf(null) === -1 &&
          variablesIdsArray.indexOf('undefined') === -1 &&
          new Date(from).getTime() > 0 &&
          new Date(to).getTime() > 0 &&
          new Date(from).getTime() < new Date(to).getTime()
        ) {
          // format dates to ISO string for the query
          from = new Date(from).toISOString();
          // if to is greater than now, set it to now
          to = new Date(to).getTime() > new Date().getTime() ? new Date().toISOString() : new Date(to).toISOString();

          // get variables ids string
          let variablesIds = '["' + variablesIdsArray.join('","') + '"]';

          // reset the buffers
          let dataBuffer: any = {};
          variablesIdsArray.map((id: string) => (dataBuffer[id] = []));
          let timeBuffer: string[] = [];

          // start the query
          const queryFinish = await this.queryLoop(
            timeBuffer,
            dataBuffer,
            variablesIds,
            from,
            to,
            queryOrder,
            queryAliases,
            queryAggregateMode,
            queryAggregateTime
          );
          //console.log(timeBuffer);
          //console.log(dataBuffer);

          let timeBuf: number[] = [];

          // after loop is finished
          if (queryFinish) {
            // convert all timestamps to epoch
            for (let j = 0; j < queryFinish.timeBuffer.length; j++) {
              timeBuf[j] = new Date(queryFinish.timeBuffer[j]).getTime();
            }

            // get the indexes of the timestamps buffer
            let orderedIndexes = Array.from(timeBuf.keys());
            if (queryOrder === 'Ascending') {
              // sort indexes based on timestamps buffer ascending
              orderedIndexes = orderedIndexes.sort((a, b) => Number(timeBuf[a]) - Number(timeBuf[b]));
            } else {
              //sort indexes based on timestamps buffer descending
              orderedIndexes = orderedIndexes.sort((a, b) => Number(timeBuf[b]) - Number(timeBuf[a]));
            }

            // init fields with timestamp buffer array ordered by the previous indexes array
            fields = [{ name: 'Time', type: FieldType.time, values: orderedIndexes.map((i) => timeBuf[i]) }];

            let dataIndex = 0;
            // push each variable buffer to fields
            for (let variableName in queryFinish.dataBuffer) {
              // create name based on aliases and aggregates
              let fName =
                queryAliases.length >= dataIndex + 1
                  ? queryAliases[dataIndex]
                  : queryAggregateMode !== 'None'
                  ? this.idNameMaps[variableName] + '_' + queryAggregateMode
                  : this.idNameMaps[variableName];
              // sort each variable buffer by the previous indexes array
              fields.push({
                name: fName,
                type: FieldType.number,
                values: orderedIndexes.map((i) => queryFinish.dataBuffer[variableName][i]),
              });
              dataIndex += 1;
            }
          }
        }
      }
      //console.log(new Date().getTime() - this.start);
      //console.log('fields', fields);
      // return the grafana fields
      return new MutableDataFrame({
        refId: query.refId,
        fields: fields,
      });
    });

    return Promise.all(promises).then((data) => ({ data }));
  }

  async customRequest(url: string, headers: object, method: string, body: object, params?: string) {
    // a custom implementation of the grafana HTTP request that handle all methods than GET
    const requestHeaders = {
      ...this.headers,
      ...headers,
    };
    //console.log('customrequest', this.baseUrl, requestHeaders);
    if (method !== 'get') {
      return getBackendSrv().datasourceRequest({
        url: `${this.baseUrl}${url}`,
        headers: requestHeaders,
        method: method,
        data: body,
        responseType: 'json',
      });
    } else {
      // if method is get call the custom get request
      return this.customGetRequest(url, requestHeaders, params);
    }
  }

  async customGetRequest(url: string, headers: object, params?: string) {
    // a custom implementation of the grafana HTTP request that handle GET API calls
    const requestHeaders = {
      ...this.headers,
      ...headers,
    };
    return getBackendSrv().datasourceRequest({
      url: `${this.baseUrl}${url}${params?.length ? `?${params}` : ''}`,
      headers: requestHeaders,
      method: 'get',
      responseType: 'json',
    });
  }

  async testDatasource() {
    // Called by Save&Test in Datasource config, Checks whether we can connect to the API
    const defaultErrorMessage = 'Cannot connect to API';

    try {
      // use get users api to test the connection (not need to be authenticated)
      const response = await this.customGetRequest('/TokenManagerService/users', {}, '');

      //console.log(response);
      if (response.status === 200) {
        return {
          status: 'success',
          message: 'Success',
        };
      } else {
        return {
          status: 'error',
          message: response.statusText ? response.statusText : defaultErrorMessage,
        };
      }
    } catch (err: any) {
      if (_.isString(err)) {
        return {
          status: 'error',
          message: err,
        };
      } else {
        let message = '';
        message += err.statusText ? err.statusText : defaultErrorMessage;
        if (err.data && err.data.error && err.data.error.code) {
          message += ': ' + err.data.error.code + '. ' + err.data.error.message;
        }

        return {
          status: 'error',
          message,
        };
      }
    }
  }
}
