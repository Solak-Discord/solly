import { Dirent, readdirSync } from 'fs';
import { EmbedBuilder, Collection, Interaction, Message, InteractionResponse, ButtonInteraction, TextChannel } from 'discord.js';
import Bot from '../Bot';
import BotInteraction from '../types/BotInteraction';
import EventEmitter = require('events');

export default interface InteractionHandler {
    client: Bot;
    commands: Collection<string, BotInteraction>;
    built: Boolean;
}

export default class InteractionHandler extends EventEmitter {
    constructor(client: Bot) {
        super();
        this.commands = new Collection();
        this.built = false;
        this.client = client;
        this.on('error', (error: unknown) => client.logger.error({ error }));
        this.client.on('interactionCreate', (interaction): Promise<any> => {
            return this.exec(interaction);
        });
    }

    // build() {
    //     if (this.built) return this;
    //     const directories = readdirSync(`${this.client.location}/src/interactions`, { withFileTypes: true });
    //     for (const directory of directories) {
    //         if (!directory.isDirectory()) continue;
    //         const commands = readdirSync(`${this.client.location}/src/interactions/${directory.name}`, { withFileTypes: true });
    //         for (const command of commands) {
    //             if (!command.isFile()) continue;
    //             if (!command.name.endsWith('.ts')) continue;
    //             import(`${this.client.location}/src/interactions/${directory.name}/${command.name}`).then((interaction) => {
    //                 const Command: BotInteraction = new interaction.default(this.client);
    //                 Command.category = directory.name.charAt(0).toUpperCase() + directory.name.substring(1);
    //                 this.commands.set(Command.name, Command);
    //                 this.client.logger.log({ message: `Command '${Command.name}' loaded`, handler: this.constructor.name, uid: `(@${Command.uid})` }, false);
    //             });
    //         }
    //     }
    //     return this;
    // }
    build() {
        if (this.built) return this;
        const dirs = readdirSync(`${this.client.location}/src/interactions`, { withFileTypes: true });
        const name = this.constructor.name;
        const commands = this.commands;
        const client = this.client;
        let cmds: Dirent[] = [];

        walk();

        async function walk() {
            if (!dirs.length) return;
            cmds = readdirSync(`${client.location}/src/interactions/${dirs[0].name}`, { withFileTypes: true }).filter((file) => file.name.endsWith('.ts'));
            await load(dirs[0].name);
            (dirs as Dirent[]).shift();
            walk();
        }

        async function load(dir: string) {
            if (!cmds.length) return;
            await actuallyLoad(dir, cmds[0]);
            (cmds as Dirent[]).shift();
            await load(dir);
        }

        async function actuallyLoad(dir: string, command: Dirent) {
            return new Promise(async (resolve) => {
                if (command.isFile()) {
                    const interaction = await import(`${client.location}/src/interactions/${dir}/${command.name}`);
                    const Command: BotInteraction = new interaction.default(client);
                    commands.set(Command.name, Command);
                    client.logger.log({ message: `Command '${Command.name}' loaded`, handler: name, uid: `(@${Command.uid})` }, false);
                }
                resolve(!0);
            });
        }
        return this;
    }

    // // check to see if the user has at least one of the roles from `pvmeData` in config file
    // public checkPermissions(interaction: Interaction, role_name_or_id?: string[]): boolean {
    //     if (!interaction.inCachedGuild()) return false;
    //     const _roles: string[] = Object.values(this.client.util.config.pvmeData);
    //     const _check: boolean = _roles.map((id) => interaction.member?.roles.cache.some((role) => role_name_or_id?.includes(role.id))).find((e) => e) ?? false;
    //     if (!_check && this.client.util.config.owners.includes(interaction.user.id)) return true; // check if this is TXJ and skip perms check
    //     return _check;
    // }

    // This method will check a `string[]` for name strings
    public checkPermissionName(interaction: Interaction, role_name: string[]): boolean {
        if (!interaction.inCachedGuild()) return false;
        if (this.client.util.config.owners.includes(interaction.user.id)) return true; // if any owner bypass perms check
        const _checkRoleName: boolean[] = role_name.map((role_string) => interaction.member.roles.cache.some((role) => role.name === role_string));
        const _containsRole: boolean = _checkRoleName.some((role) => role === true);
        return _containsRole;
    }

    public checkPermissionID(interaction: Interaction, role_id: string[]): boolean {
        if (!interaction.inCachedGuild()) return false;
        if (this.client.util.config.owners.includes(interaction.user.id)) return true; // if any owner bypass perms check
        const _checkRoleID: boolean[] = role_id.map((role_id) => interaction.member.roles.cache.some((role) => role.id === role_id));
        const _containsRole: boolean = _checkRoleID.some((role) => role === true);
        return _containsRole;
    }

    public hasRolePermissions = async (roleList: string[], interaction: Interaction) => {
        if (!interaction.inCachedGuild()) return;
        const validRoleIds = roleList.map((key) => this.client.util.utilities.functions.stripRole(this.client.util.utilities.roles[key]));
        const user = await interaction.guild.members.fetch(interaction.user.id);
        const userRoles = user.roles.cache.map((role) => role.id);
        const intersection = validRoleIds.filter((roleId) => userRoles.includes(roleId));
        return intersection.length > 0;
    }

    public async handleButton(interaction: ButtonInteraction<'cached'>): Promise<Message<true> | InteractionResponse<true> | void> {
        if (interaction.customId === 'rejectRoleAssign') {
            await interaction.deferReply({ ephemeral: true });
            if (await this.hasRolePermissions(['admin', 'owner'], interaction)) {
                const messageEmbed = interaction.message.embeds[0];
                const messageContent = messageEmbed.data.description;
                const oldTimestamp = messageEmbed.timestamp ? new Date(messageEmbed.timestamp) : new Date();
                const newEmbed = new EmbedBuilder()
                    .setTimestamp(oldTimestamp)
                    .setColor(messageEmbed.color)
                    .setDescription(`${messageContent}\n\n> Role Rejected by <@${interaction.user.id}> <t:${Math.round(Date.now() / 1000)}:R>.`);
                const assignedRoles = messageContent?.match(/<@&\d*\>/gm)?.map(unstrippedRole => this.client.util.utilities.functions.stripRole(unstrippedRole));
                const userIdRegex = messageContent?.match(/to <@\d*\>/gm);
                const messageIdRegex = messageContent?.match(/\[\d*\]/gm)
                let dirtyUserId;
                let dirtyMessageId;
                if (!assignedRoles) return;
                if (userIdRegex) dirtyUserId = userIdRegex[0];
                if (messageIdRegex) dirtyMessageId = messageIdRegex[0];
                if (dirtyUserId) {
                    const userId = dirtyUserId.slice(5, -1);
                    const user = await interaction.guild?.members.fetch(userId);
                    for await (const assignedId of assignedRoles) {
                        await user.roles.remove(assignedId);
                    };
                }
                if (dirtyMessageId && messageContent) {
                    const messageId = dirtyMessageId.slice(1, -1);
                    const channelId = messageContent.split('/channels/')[1].split('/')[1];
                    const channel = await interaction.guild.channels.fetch(channelId) as TextChannel;
                    const message = await channel.messages.fetch(messageId);
                    await message.delete();
                }
                await interaction.message.edit({ embeds: [newEmbed], components: [] })
                const replyEmbed = new EmbedBuilder()
                    .setColor(this.client.util.utilities.colours.discord.green)
                    .setDescription('Role successfully rejected!');
                return await interaction.editReply({ embeds: [replyEmbed] });
            } else {
                this.client.logger.log(
                    {
                        message: `Attempted restricted permissions. { command: Reject Role Assign, user: ${interaction.user.username}, channel: ${interaction.channel} }`,
                        handler: this.constructor.name,
                    },
                    true
                );
                return await interaction.editReply({ content: 'You do not have permissions to run this command. This incident has been logged.' });
            }
        }
    }

    async exec(interaction: Interaction): Promise<any> {
        if (interaction.isButton() && interaction.inCachedGuild()) { return this.handleButton(interaction) }
        if (interaction.isCommand() && interaction.isRepliable() && interaction.inCachedGuild()) {
            try {
                const command = this.commands.get(interaction.commandName);
                if (!command) return;
                switch (command.permissions) {
                    case 'OWNER':
                        if (interaction.isRepliable() && !this.client.util.config.owners.includes(interaction.user.id)) {
                            this.client.logger.log(
                                {
                                    message: `Attempted restricted permissions. { command: ${command.name}, user: ${interaction.user.username}, channel: ${interaction.channel} }`,
                                    handler: this.constructor.name,
                                },
                                true
                            );
                            return await interaction.reply({ content: 'You do not have permissions to run this command. This incident has been logged.', ephemeral: true });
                        }
                        break;
                    case 'TRIAL_TEAM':
                        if (!(await this.hasRolePermissions(['trialTeam', 'admin', 'owner'], interaction))) {
                            this.client.logger.log(
                                {
                                    message: `Attempted restricted permissions. { command: ${command.name}, user: ${interaction.user.username}, channel: ${interaction.channel} }`,
                                    handler: this.constructor.name,
                                },
                                true
                            );
                            return await interaction.reply({ content: 'You do not have permissions to run this command. This incident has been logged.', ephemeral: true });
                        }
                        break;
                    default:
                        break;
                }
                this.client.logger.log(
                    {
                        handler: this.constructor.name,
                        user: `${interaction.user.username} | ${interaction.user.id}`,
                        message: `Executing Command ${command.name}`,
                        uid: `(@${command.uid})`,
                    },
                    true
                );
                await command.run(interaction);
                this.client.commandsRun++;
            } catch (error: any) {
                const embed = new EmbedBuilder()
                    .setColor(0xff99cc)
                    .setTitle('Something errored!')
                    .setDescription(`\`\`\`js\n ${error.toString()}\`\`\``)
                    .setTimestamp()
                    .setFooter({ text: this.client.user?.username ?? '', iconURL: this.client.user?.displayAvatarURL() });
                this.client.logger.error({
                    handler: this.constructor.name,
                    message: 'Something errored!',
                    error: error.stack,
                });
                interaction.editReply({ embeds: [embed] });
            }
        }
    }
}
