require('dotenv').config();
require('array-flat-polyfill');
const ms = require('ms');
const fs = require('fs');
const T = require('./lib/twit');
const chunkify = require('./lib/chunking');

const cutLimit = ms('280 days');

//Stolen from https://github.com/wesbos/twitter-unfollower
async function findLastTweet(screenNames) {
  // given an array of screen names, look up their last tweet
  const { data: users } = await T.post('users/lookup', {
    screen_name: screenNames,
  });

  const cutList = users
    // some people deleted all their tweets, we mark them as old
    .map(user => {
      user.status = user.status || { created_at: 0 };
      return user;
    })
    // massage the data into what we need
    .map(user => ({
      screen_name: user.screen_name,
      id: user.id,
      lastTweet: new Date(user.status.created_at).getTime(),
      timeSinceLastTweet:
        Date.now() - new Date(user.status.created_at).getTime(),
    }))
    // cut anyone over the limit
    .filter(user => user.timeSinceLastTweet > cutLimit);

  return cutList;
}

async function getUsersFromReadme() {
    const rawdata = fs.readFileSync('README.md', 'utf8');
    return rawdata.split('\n')
           .map((line) => line.match(/\[Twitter\]\(https:\/\/twitter.com\/(.*)\)/))
           .filter(n => n)
           .map((match) => match[1]);
}

function showUsersWithoutTweets(users) {
    console.log(`Los siguientes usuarios no han publicado nada en los últimos ${ms(cutLimit, { long: true })} o tienen su cuenta bloqueada`);
    console.log('-------------');
    users.map((user) => console.log(user.screen_name));
    console.log('-------------');
}

function handleError(err) {
    console.log('-------------');
    console.log('Oh no!');
    console.log(err);
    console.log('-------------');
    process.exit(1);
}

async function go() {

  const users = await getUsersFromReadme();

  const chunkedUsers = chunkify(users, 100);
  const userPromises = chunkedUsers.map(findLastTweet);
  const usersWithoutTweets = (await Promise.all(userPromises)).flat();

  
  if (usersWithoutTweets.length) {
      showUsersWithoutTweets(usersWithoutTweets);
  }
  
  process.exit(usersWithoutTweets.length != 0);
}

go().catch(handleError);
