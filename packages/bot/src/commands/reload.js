export default {
  name: 'reload',
  category: 'owner',
  description: 'Reload command files.',
  ownerOnly: true,
  async execute({ registry, reply }) {
    await registry.load()
    await reply(`Reloaded ${registry.count()} command files.`)
  },
}
