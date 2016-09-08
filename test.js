function count(s = 0, m = 0, i = 1000) {
  if (s <= m) {
    console.log(s);
    setTimeout(() => count(++s, m, i), i);
  }
}

const args = process.argv.slice(2);
count(Number(args[0]), Number(args[1]), Number(args[2]));