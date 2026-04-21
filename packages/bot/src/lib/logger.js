import chalk from 'chalk'

function stamp(label, color, message) {
  console.log(color(`[${label}]`), message)
}

export const logger = {
  info(message) {
    stamp('info', chalk.cyan, message)
  },
  success(message) {
    stamp('done', chalk.green, message)
  },
  warn(message) {
    stamp('warn', chalk.yellow, message)
  },
  error(message) {
    stamp('fail', chalk.red, message)
  },
}
