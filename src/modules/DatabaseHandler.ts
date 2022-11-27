import Keyv = require('keyv');
import KeyvFile from 'keyv-file';
import Bot from '../Bot';

//prettier-ignore
export default interface DatabaseHandler { client: Bot; }

export default class DatabaseHandler extends Keyv {
    constructor(client: Bot, name: string) {
        super({
            store: new KeyvFile({
                filename: name,
                writeDelay: 100,
                encode: JSON.stringify,
                decode: JSON.parse,
            }),
        });

        this.client = client;

        this.on('error', () =>
            this.client.logger.error({
                handler: this.constructor.name,
                error: `Failed to connect to the database handler for ${name}`,
            })
        );
    }
}