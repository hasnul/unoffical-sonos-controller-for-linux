import React from 'react';
import { connect } from 'react-redux';

import {
    getZoneGroups,
    getCurrentHost,
    getPlayStates
} from '../selectors/ZoneGroupSelectors';

import ZoneGroup from './ZoneGroup';

export const mapStateToProps = state => {
    return {
        groups: getZoneGroups(state),
        playStates: getPlayStates(state),
        currentHost: getCurrentHost(state)
    };
};

export function ZoneGroupList(props) {
    const zoneGroupNodes = Object.keys(props.groups || {}).map(key => {
        const item = props.groups[key];
        return <ZoneGroup key={key} group={item} {...props} />;
    });

    return (
        <div
            id="zone-container-inner"
            style={{ width: '100%', display: 'flex', flexDirection: ' column' }}
        >
            <div style={{ overflowY: 'auto' }}>
                <div id="zone-wrapper">{zoneGroupNodes}</div>
            </div>
        </div>
    );
}

export default connect(mapStateToProps, null)(ZoneGroupList);
