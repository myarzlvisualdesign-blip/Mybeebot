export default {
  name: 'reload',
  category: 'owner',
  description: 'Muat ulang semua file command.',
  ownerOnly: true,
  async execute({ registry, reply, state }) {
    await registry.load()
    state.commandCount = registry.count()
    await reply(`Berhasil reload ${registry.count()} command.`)
  },
}
