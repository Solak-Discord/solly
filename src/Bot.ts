import 'dotenv/config';
import { Client, ClientOptions } from 'discord.js';
import BotLogger from './modules/LoggingHandler';
import InteractionHandler from './modules/InteractionHandler';
import EventHandler from './modules/EventHandler';
import UtilityHandler from './modules/UtilityHandler';
import DatabaseHandler from './modules/DatabaseHandler';
import TempChannelManager from './modules/TempVCHandler';
import Keyv = require('keyv');

export default interface Bot extends Client {
    color: number;
    commandsRun: number;
    util: UtilityHandler;
    quitting?: boolean;
    location?: string;
    logger: BotLogger;
    interactions: InteractionHandler;
    events: EventHandler;
    database: Keyv<any, Record<string, unknown>>;
    tempManager: TempChannelManager;
}

export default class Bot extends Client {
    constructor(options: ClientOptions) {
        super(options);

        this.color = 0x7e686c;
        this.database = new DatabaseHandler(this, 'db.json');
        this.commandsRun = 0;
        this.util = new UtilityHandler(this);
        this.quitting = false;
        this.location = process.cwd();
        this.logger = new BotLogger();
        this.interactions = new InteractionHandler(this).build();
        this.events = new EventHandler(this).build();
        this.tempManager = new TempChannelManager(this);

        process.on('unhandledRejection', (err: any): void => {
            this.logger.error({ message: `UnhandledRejection from Process`, error: err.stack });
        });

        ['beforeExit', 'SIGUSR1', 'SIGUSR2', 'SIGINT', 'SIGTERM'].map((event: string) => process.once(event, this.exit.bind(this)));
    }

    async login() {
        await super.login(process.env.TOKEN);
        const overrides = await this.database.get('overrides');
        const overridesObject = {
            reports: ['258055326215962626'],
            assign: ['258055326215962626']
        }
        if (!overrides) await this.database.set('overrides', overridesObject);
        return this.constructor.name;
    }

    exit() {
        if (this.quitting) return;
        this.quitting = true;
        this.destroy();
    }
}
