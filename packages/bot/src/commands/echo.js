export default {
  name: 'echo',
  category: 'utilitas',
  description: 'Kirim ulang teks ke chat.',
  async execute({ args, config, reply }) {
    if (!args.length) {
      await reply(`Contoh: ${config.prefix}echo halo semua`)
      return
    }

    await reply(args.join(' '))
  },
}
