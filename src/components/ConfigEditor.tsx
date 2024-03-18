import React, { ChangeEvent } from 'react';
import { InlineField, Input, SecretInput, InlineSwitch } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { MyDataSourceOptions } from '../types';

interface Props extends DataSourcePluginOptionsEditorProps<MyDataSourceOptions> { }

export function ConfigEditor(props: Props) {

  const { onOptionsChange, options } = props;

  const onURLChange = (event: ChangeEvent<HTMLInputElement>) => {
    const jsonData = {
      ...options.jsonData,
      remoteUrl: event.target.value,
    };
    onOptionsChange({ ...options, jsonData });
  };

  const onIsRemoteChange = (event: ChangeEvent<HTMLInputElement>) => {
    //console.log(event.target.value, event.target.checked);
    const jsonData = {
      ...options.jsonData,
      isRemote: Boolean(event.target.checked),
    };
    onOptionsChange({ ...options, jsonData });
  };

  const onRemoteUserChange = (event: ChangeEvent<HTMLInputElement>) => {
    const jsonData = {
      ...options.jsonData,
      remoteUser: event.target.value,
    };
    onOptionsChange({ ...options, jsonData });
  };

  const onRemotePasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    const jsonData = {
      ...options.jsonData,
      remotePassword: event.target.value,
    };
    onOptionsChange({ ...options, jsonData });
  };


  const { jsonData } = options;

  return (
    <div className="gf-form-group">

      <InlineField label="IIH Essentials on a remote IED?"
        labelWidth={48}
        tooltip="Is IIH Essentials App installed on a different IED?">
        <InlineSwitch label="Remote IED"
          showLabel={true}
          value={jsonData.isRemote}
          onChange={onIsRemoteChange} />
      </InlineField>

      <InlineField label="Remote IED URL"
        labelWidth={25}
        disabled={jsonData.isRemote ? false : true}
        tooltip="If IIH Essentials is installed on 
        a Remote IED then insert here its IP or FQDN (e.g. ).">
        <Input
          onChange={onURLChange}
          value={jsonData.remoteUrl || ""}
          placeholder="Insert IP Address or FQDN of Remote IED"
          width={40}
        />
      </InlineField>

      <InlineField label="Remote IED User"
        labelWidth={25}
        disabled={jsonData.isRemote ? false : true}
        tooltip="IED Login User that can access 
        Remote IED where IIH Essentials App is installed.">
        <Input
          onChange={onRemoteUserChange}
          value={jsonData.remoteUser || ""}
          width={40}
        />
      </InlineField>

      <InlineField label="Remote IED Password"
        labelWidth={25}
        disabled={jsonData.isRemote ? false : true}
        tooltip="IED Login User that can access 
        Remote IED where IIH Essentials App is installed.">
        <SecretInput
          onChange={(event: ChangeEvent<HTMLInputElement>) => onRemotePasswordChange(event)}
          onReset={() => { return ""; }}
          isConfigured={false}
          value={jsonData.remotePassword || ""}
          width={40}
        />
      </InlineField>

    </div>
  );
}
