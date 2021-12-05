import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { DataSourceHttpSettings } from '@grafana/ui';
import React from 'react';
import { MyDataSourceOptions } from './types';

interface Props extends DataSourcePluginOptionsEditorProps<MyDataSourceOptions> {}

export const ConfigEditor: React.FC<Props> = ({ onOptionsChange, options }) => {
  return (
    <DataSourceHttpSettings
      defaultUrl={'http://edgeappdataservice:4203'}
      dataSourceConfig={options}
      onChange={onOptionsChange}
      showForwardOAuthIdentityOption={false}
      showAccessOptions={false}
      sigV4AuthToggleEnabled={false}
    />
  );
};
