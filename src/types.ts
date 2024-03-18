import { DataSourceJsonData, SelectableValue } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

export interface MyQuery extends DataQuery {
  from: string;
  to: string;
  order: string;
  variablesNamesList: string[];
  variablesOptions: Array<SelectableValue<string>>;
  aggregateModesList: string[];
  aliasesList: string[];
  aggregateTime: string;
  where: MyQueryWhere;
  variablesNamesListOptions: Array<SelectableValue<string>>;
}

export const DEFAULT_QUERY: Partial<MyQuery> = {
  from: '${__from:date}',
  to: '${__to:date}',
  order: 'Ascending',
  variablesNamesList: [''],
  variablesOptions: [],
  aggregateModesList: ['None'],
  aliasesList: [''],
  aggregateTime: 'None',
  where: { items: [], operators: [] },
  variablesNamesListOptions: []
};

export type MyQueryWhere = {
  items: MyQueryWhereItem[],
  operators: whereOperatorType[]
}

export type MyQueryWhereItem = {
  element1: string;
  comparator: whereComparatorType;
  element2: string;
};

export interface MyVariableQuery {
  from: string;
  to: string;
  order: string;
  variablesNamesList: string[];
  variablesOptions: Array<SelectableValue<string>>;
  aggregateModesList: string[];
  aliasesList: string[];
  aggregateTime: string;
  where: MyQueryWhere;
  variablesNamesListOptions: Array<SelectableValue<string>>;
}

export const DEFAULT_QUERY_VARIABLE: Partial<MyVariableQuery> = {
  from: '${__from:date}',
  to: '${__to:date}',
  order: 'Ascending',
  variablesNamesList: [''],
  variablesOptions: [],
  aggregateModesList: ['None'],
  aliasesList: [''],
  aggregateTime: 'None',
  where: { items: [], operators: [] },
  variablesNamesListOptions: []
};

// query editor select where comparator options
export const whereComparatorOptions: Array<SelectableValue<whereComparatorType>> = [
  { label: '=', value: '=' },
  { label: '!=', value: '!=' },
  { label: '<', value: '<' },
  { label: '>', value: '>' },
  { label: '<=', value: '<=' },
  { label: '>=', value: '>=' },
  { label: 'includes', value: 'includes' },
  { label: 'not includes', value: 'not includes' },
  { label: 'starts with', value: 'starts with' },
  { label: 'ends with', value: 'ends with' }
];

// query editor select where comparator options
export const whereOperatorOptions: Array<SelectableValue<whereOperatorType>> = [
  { label: 'and', value: 'and' },
  { label: 'or', value: 'or' }
];

export type whereComparatorType = '=' | '!=' | '<' | '>' | '<=' | '>='
  | "includes" | "not includes" | "starts with" | "ends with";

export type whereOperatorType = 'and' | 'or' | '';

// query editor select order options
export const orderOptions: Array<SelectableValue<string>> = [
  { label: 'Ascending', value: 'Ascending' },
  { label: 'Descending', value: 'Descending' },
];

// query editor select aggregate mode options
export const aggregateModeOptions: Array<SelectableValue<string>> = [
  { label: 'None', value: 'None' },
  { label: 'First', value: 'First' },
  { label: 'Last', value: 'Last' },
  { label: 'Max', value: 'Max' },
  { label: 'Min', value: 'Min' },
  { label: 'Average', value: 'Average' },
  { label: 'Sum', value: 'Sum' },
  { label: 'Counter', value: 'Counter' },
  { label: 'Count', value: 'Count' },
  { label: 'StandardDeviation', value: 'StandardDeviation' },
  { label: 'Variance', value: 'Variance' },
  { label: 'TimeWeightedAverage', value: 'TimeWeightedAverage' },
  { label: 'Timer', value: 'Timer' },
  { label: 'Duration', value: 'Duration' },
  { label: 'Occurrence', value: 'Occurrence' },
  { label: 'MinWithTimestamp', value: 'MinWithTimestamp' },
  { label: 'MaxWithTimestamp', value: 'MaxWithTimestamp' },
  { label: 'FirstWithTimestamp', value: 'FirstWithTimestamp' },
  { label: 'LastWithTimestamp', value: 'LastWithTimestamp' },
  { label: 'PowerToEnergy', value: 'PowerToEnergy' },
  { label: 'EnergyToPower', value: 'EnergyToPower' },
  { label: 'FlowToAmount', value: 'FlowToAmount' },
  { label: 'AmountToFlow', value: 'AmountToFlow' },
  { label: 'ValueChanges', value: 'ValueChanges' },
  { label: 'StepDuration', value: 'StepDuration' },
  { label: 'MinMaxTrend', value: 'MinMaxTrend' },
  { label: 'Gantt', value: 'Gantt' },
  { label: 'GanttView', value: 'GanttView' }
];

// query editor select aggregate mode options for Calculate Mode
export const aggregateModeOptionsCalculate: Array<SelectableValue<string>> = [
  { label: 'None', value: 'None' },
  { label: 'First', value: 'First' },
  { label: 'Last', value: 'Last' },
  { label: 'Max', value: 'Max' },
  { label: 'Min', value: 'Min' },
  { label: 'Average', value: 'Average' },
  { label: 'Sum', value: 'Sum' },
  { label: 'Counter', value: 'Counter' },
  { label: 'Count', value: 'Count' },
  { label: 'StandardDeviation', value: 'StandardDeviation' },
  { label: 'Variance', value: 'Variance' },
  { label: 'TimeWeightedAverage', value: 'TimeWeightedAverage' },
  { label: 'Timer', value: 'Timer' },
  { label: 'Duration', value: 'Duration' },
  { label: 'Occurrence', value: 'Occurrence' },
  { label: 'MinWithTimestamp', value: 'MinWithTimestamp' },
  { label: 'MaxWithTimestamp', value: 'MaxWithTimestamp' },
  { label: 'FirstWithTimestamp', value: 'FirstWithTimestamp' },
  { label: 'LastWithTimestamp', value: 'LastWithTimestamp' },
  { label: 'PowerToEnergy', value: 'PowerToEnergy' },
  { label: 'EnergyToPower', value: 'EnergyToPower' },
  { label: 'FlowToAmount', value: 'FlowToAmount' },
  { label: 'AmountToFlow', value: 'AmountToFlow' }
];

// query editor select aggregate time options
export const aggregateTimeOptions: Array<SelectableValue<string>> = [
  { label: 'None', value: 'None' },
  { label: '1s', value: '1s' },
  { label: '2s', value: '2s' },
  { label: '3s', value: '3s' },
  { label: '4s', value: '4s' },
  { label: '5s', value: '5s' },
  { label: '10s', value: '10s' },
  { label: '15s', value: '15s' },
  { label: '20s', value: '20s' },
  { label: '25s', value: '25s' },
  { label: '30s', value: '30s' },
  { label: '45s', value: '45s' },
  { label: '1m', value: '1m' },
  { label: '2m', value: '2m' },
  { label: '3m', value: '3m' },
  { label: '4m', value: '4m' },
  { label: '5m', value: '5m' },
  { label: '10m', value: '10m' },
  { label: '15m', value: '15m' },
  { label: '20m', value: '20m' },
  { label: '30m', value: '30m' },
  { label: '1h', value: '1h' },
  { label: '2h', value: '2h' },
  { label: '6h', value: '6h' },
  { label: '8h', value: '8h' },
  { label: '12h', value: '12h' },
  { label: '1d', value: '1d' },
  { label: '10d', value: '10d' },
  { label: '30d', value: '30d' },
];

export const aggregateTimeMap: any = {
  "None": 0,
  "1s": 1000,
  "2s": 2000,
  "3s": 3000,
  "4s": 4000,
  "5s": 5000,
  "10s": 10000,
  "15s": 15000,
  "20s": 20000,
  "25s": 25000,
  "30s": 30000,
  "45s": 45000,
  "1m": 60000,
  "2m": 120000,
  "3m": 180000,
  "4m": 240000,
  "5m": 300000,
  "10m": 600000,
  "15m": 900000,
  "20m": 1200000,
  "30m": 1800000,
  "1h": 3600000,
  "2h": 7200000,
  "6h": 21600000,
  "8h": 28800000,
  "12h": 43200000,
  "1d": 86400000,
  "10d": 864000000,
  "30d": 2592000000
};

export type QueryGroupObject = {
  Data: {
    variablesIdsList: string[],
  },
  Aggregate: {
    variablesIdsList: string[],
    aggregateModesList: string[]
  },
  AggregateTrend: {
    variablesIdsList: string[],
    aggregateModesList: string[]
  }
};

export type AllowedRequestType = "json" | "text" | "arraybuffer" | "blob" | undefined;

/**
 * These are options configured for each DataSource instance
 */
export interface MyDataSourceOptions extends DataSourceJsonData {
  isRemote?: boolean;
  remoteUrl?: string;
  remoteUser?: string;
  remotePassword?: string;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface MySecureJsonData {
  apiKey?: string;
}
