export default {
  name: 'echo',
  category: 'utility',
  description: 'Echo text back to the chat.',
  async execute({ args, reply }) {
    if (!args.length) {
      await reply('Usage: .echo your text here')
      return
    }

    await reply(args.join(' '))
  },
}
