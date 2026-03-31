import { Injectable } from '@nestjs/common';
import { EmbedBuilder, User } from 'discord.js';
import type { SlashCommandContext } from 'necord';
import { Context, Options, SlashCommand, StringOption, UserOption } from 'necord';
import { SyncService } from '../../sync/sync.service';

class WhoisOptions {
  @UserOption({
    name: 'discord',
    description: 'ค้นหาจาก Discord User',
    required: false,
  })
  discord: User | null;

  @StringOption({
    name: 'minecraft',
    description: 'ค้นหาจาก Minecraft Name',
    required: false,
  })
  minecraft: string | null;
}

@Injectable()
export class WhoisCommand {
  constructor(private readonly syncService: SyncService) {}

  @SlashCommand({
    name: 'whois',
    description: 'ตรวจสอบสถานะ Sync ของผู้เล่น',
    defaultMemberPermissions: ['ManageGuild'],
  })
  async onWhois(
    @Context() [interaction]: SlashCommandContext,
    @Options() { discord, minecraft }: WhoisOptions,
  ) {
    if (!discord && !minecraft) {
      await interaction.reply({
        content: '❌ กรุณาระบุ Discord User หรือ Minecraft Name อย่างน้อย 1 อย่าง',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const record = discord
      ? await this.syncService.findByDiscordId(discord.id)
      : await this.syncService.findByMinecraftName(minecraft!);

    if (!record) {
      await interaction.editReply({ content: '❌ ไม่พบข้อมูลผู้เล่นในระบบ' });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🔍 ข้อมูล Sync')
      .setColor(record.isSynced ? 0x57f287 : 0xed4245)
      .setThumbnail(
        `https://mineskin.eu/helm/${record.minecraftName}/100.png`,
      )
      .addFields(
        {
          name: '🎮 Minecraft',
          value: `\`${record.minecraftName}\`\n\`${record.minecraftUuid}\``,
          inline: true,
        },
        {
          name: '💬 Discord',
          value: record.discordId ? `<@${record.discordId}>` : '—',
          inline: true,
        },
        {
          name: '✅ สถานะ',
          value: record.isSynced ? 'เชื่อมต่อแล้ว' : 'ยังไม่ได้เชื่อมต่อ',
          inline: true,
        },
        {
          name: '📅 วันที่ Sync',
          value: record.syncDate
            ? `<t:${Math.floor(record.syncDate.getTime() / 1000)}:f>`
            : '—',
          inline: true,
        },
      )
      .setFooter({ text: `ID: ${record.id}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}
