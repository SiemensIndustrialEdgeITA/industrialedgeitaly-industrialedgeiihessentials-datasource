import { DataQuery, DataSourceJsonData, SelectableValue } from '@grafana/data';

export interface MyQuery extends DataQuery {
  variablesNames: string;
  variablesOptions: Array<SelectableValue<string>>;
  variablesRawMode: boolean;
  from: string;
  to: string;
  order: string;
  aggregateMode: string;
  aggregateTime: string;
  aliases: string;
}

export const defaultQuery: Partial<MyQuery> = {
  variablesNames: '',
  variablesOptions: [],
  variablesRawMode: false,
  from: '${__from:date}',
  to: '${__to:date}',
  order: 'Ascending',
  aggregateMode: 'None',
  aggregateTime: 'None',
  aliases: '',
};

// query editor select order options
export const orderOptions: Array<SelectableValue<string>> = [
  { label: 'Ascending', value: 'Ascending' },
  { label: 'Descending', value: 'Descending' },
];

// query editor select aggregate mode options
export const aggregateModeOptions: Array<SelectableValue<string>> = [
  { label: 'None', value: 'None' },
  { label: 'Last', value: 'Last' },
  { label: 'Max', value: 'Max' },
  { label: 'Min', value: 'Min' },
  { label: 'Average', value: 'Average' },
  { label: 'Sum', value: 'Sum' },
  { label: 'Counter', value: 'Counter' },
];

// query editor select aggregate time options
export const aggregateTimeOptions: Array<SelectableValue<string>> = [
  { label: 'None', value: 'None' },
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '10m', value: '10m' },
  { label: '30m', value: '30m' },
  { label: '1h', value: '1h' },
  { label: '12h', value: '12h' },
  { label: '1d', value: '1d' },
];

/**
 * These are options configured for each DataSource instance
 */
export interface MyDataSourceOptions extends DataSourceJsonData {
  path?: string;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface MySecureJsonData {
  apiKey?: string;
}
