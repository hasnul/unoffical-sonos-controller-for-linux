import _ from 'lodash';

import request from 'axios';

import { Sonos, Services, Helpers } from 'sonos';

import DevicePropertiesEnhanced from './DevicePropertiesEnhanced';
import RenderingControlEnhanced from './RenderingControlEnhanced';
import ContentDirectoryEnhanced from './ContentDirectoryEnhanced';

const TUNEIN_ID = 65031;

export default class SonosEnhanced extends Sonos {
    constructor(host, model) {
        super(host);
        this.model = model;
    }

    async initialise() {
        this._zpInfo = await this.getZPInfo();
    }

    get UUID() {
        return this._zpInfo.LocalUID;
    }

    get householdId() {
        return this._zpInfo.HouseholdControlID;
    }

    get deviceId() {
        return this._zpInfo.SerialNumber;
    }

    get icon() {
        return this._zpInfo.ZoneIcon;
    }

    get name() {
        return this._zpInfo.ZoneName;
    }

    musicServices() {
        return new Services.MusicServices(this.host, this.port);
    }

    devicePropertiesService() {
        return new DevicePropertiesEnhanced(this.host, this.port);
    }

    renderingControlService() {
        return new RenderingControlEnhanced(this.host, this.port);
    }

    contentDirectoryService() {
        return new ContentDirectoryEnhanced(this.host, this.port);
    }

    groupRenderingControlService() {
        return new Services.GroupRenderingControl(this.host, this.port);
    }

    async getBalance() {
        return (
            (await this.renderingControlService().GetVolume('LF')) -
            (await this.renderingControlService().GetVolume('RF'))
        );
    }

    async setBalance(balance) {
        let rightVolume = 100,
            leftVolume = 100;

        if (balance > 0) {
            rightVolume = 100 - balance;
        } else if (balance < 0) {
            leftVolume = 100 - balance * -1;
        }

        await this.renderingControlService().SetVolume(leftVolume, 'LF');
        await this.renderingControlService().SetVolume(rightVolume, 'RF');
    }

    async getZPInfo() {
        try {
            const uri = `http://${this.host}:${this.port}/status/zp`;
            const response = await request(uri);
            const data = await Helpers.ParseXml(response.data);
            console.log(data);
            return data.ZPSupportInfo.ZPInfo;
        } catch (e) {
            console.log(e);
            return {};
        }
    }

    async getAvailableServices() {
        const data = await this.musicServices().ListAvailableServices();

        const servicesObj = await Helpers.ParseXml(
            data.AvailableServiceDescriptorList
        );

        const serviceDescriptors = servicesObj.Services.Service.map((obj) => {
            const stringsUri = _.get(obj, 'Presentation.Strings.Uri');
            const mapUri = _.get(obj, 'Presentation.PresentationMap.Uri');
            const manifestUri = _.get(obj, 'Manifest.Uri');

            return _.assign({}, obj, obj.Policy, {
                manifestUri,
                presentation: {
                    stringsUri,
                    mapUri,
                },
            });
        });

        const services = [];

        [TUNEIN_ID, ...data.AvailableServiceTypeList.split(',')].forEach(
            async (t) => {
                const serviceId =
                    Math.floor(Math.abs((t - 7) / 256)) || Number(t);
                const match = _.find(serviceDescriptors, {
                    Id: String(serviceId),
                });

                if (match) {
                    match.ServiceIDEncoded = Number(t);
                    services.push(match);
                }
            }
        );

        return services;
    }

    async queryMusicLibrary(
        searchType,
        searchTerm,
        requestOptions = {},
        separator = ':'
    ) {
        const searchTypes = {
            artists: 'A:ARTIST',
            albumArtists: 'A:ALBUMARTIST',
            albums: 'A:ALBUM',
            genres: 'A:GENRE',
            composers: 'A:COMPOSER',
            tracks: 'A:TRACKS',
            playlists: 'A:PLAYLISTS',
            sonos_playlists: 'SQ',
            share: 'S',
        };

        const defaultOptions = {
            BrowseFlag: 'BrowseDirectChildren',
            Filter: '*',
            StartingIndex: '0',
            RequestedCount: '100',
            SortCriteria: '',
        };

        let searches = searchTypes[searchType]
            ? `${searchTypes[searchType]}${separator}`
            : searchType;

        if (searchTerm && searchTerm !== '') {
            searches = `${searches}${separator}${encodeURIComponent(
                searchTerm
            )}`;
        }

        let opts = {
            ObjectID: searches,
        };
        if (requestOptions && requestOptions.start !== undefined) {
            opts.StartingIndex = requestOptions.start;
        }
        if (requestOptions && requestOptions.total !== undefined) {
            opts.RequestedCount = requestOptions.total;
        }
        // opts = _.extend(defaultOptions, opts)
        opts = Object.assign({}, defaultOptions, opts);
        const result = await this.contentDirectoryService().GetResult(opts);
        return result;
    }
}
