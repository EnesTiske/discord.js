let { token, coinStatsOpenApiKey, dextoolsApiKey, savedChannelId, requests, rsiLimit, admins } = require('./config/config.json');
const { Telegraf } = require('telegraf')
const axios = require('axios');
const fs = require('fs');
const bot = new Telegraf(token);
const cron = require('node-cron');

// const blockChains = ['solana', 'avalanche', 'ethereum'];
const blockChains = ['solana'];


let savedChannelIdG = savedChannelId
let channels = [];
let coinStatsOpenApiKeyG = coinStatsOpenApiKey;
let isRunning = false;
let updatePriceDataInterval
let dayInterval
let allChainFetchInterval
let retryAfter


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


async function sendMessageToChannel(channelId, message) {
    try {
        await bot.telegram.sendMessage(channelId, message);
        console.log(`Message sent to channel ID: ${channelId}\n`);
    } catch (error) {
        console.error(`Error sending message to channel ID: ${channelId}`, error);

        if (error.response && error.response.error_code === 429) {
            retryAfter = error.response.parameters.retry_after;
            console.log(`Retrying after ${retryAfter} seconds...`);
            await sleep(retryAfter * 1000);
            retryAfter = 0.1
            sendMessageToChannel(channelId, message);
        }
    }
}



//#region --- channel ---

bot.on('my_chat_member', (ctx) => {
    const chat = ctx.update.my_chat_member.chat;
    const chatType = chat.type;
    if (chatType === 'channel' || chatType === 'supergroup') {
        const isChannelAdded = channels.find(channel => channel.id === chat.id);
        if (!isChannelAdded) {
            channels.push({ id: chat.id, title: chat.title, type: chatType });
            console.log(`Added to channel/supergroup: ${chat.title}`);

            fs.writeFile('src/data/channels.json', JSON.stringify(channels, null, 2), (err) => {
                if (err) {
                    console.log('Dosyaya kaydederken bir hata oluştu:', err);
                } else {
                    console.log('channels bilgisi src/data/data.json dosyasına başarıyla kaydedildi.');
                }
            });
        }
    }
});

bot.command('get_channels', (ctx) => {
    if (!admins.some(admin => admin === ctx.from.id)) {
        return
    }
    let message = 'Bot is active in the following channels/groups:\n';
    channels.forEach(channel => {
        message += `${channel.title} (ID: ${channel.id}, Type: ${channel.type})\n`;
    });
    message += ""
    ctx.reply(message);
});

bot.command('set_channel', (ctx) => {
    if (!admins.some(admin => admin === ctx.from.id)) {
        return
    }
    const parts = ctx.message.text.split(' ');
    if (parts.length < 2) {
        ctx.reply('Please provide a channel ID. Usage: /set_channel <channel_id>');
        return;
    }

    const channelId = parts[1];
    savedChannelIdG = channelId;
    ctx.reply(`Channel ID set to: ${channelId}`);

    ctx.reply(savedChannelIdG, "Channel successfully configured.")

});

//#endregion --- channel ---







//#region --- start stop ---

bot.start((ctx) => {
    ctx.reply("/get_channels: To view the list of channels where the bot is present.\n/set_channel: To select the channel for the bot to send notifications.\n\n/start_bot\n/stop_bot")
})

bot.help((ctx) => {
    ctx.reply("/get_channels: To view the list of channels where the bot is present.\n/set_channel: To select the channel for the bot to send notifications.\n\n/start_bot\n/stop_bot")
})

bot.command('start_bot', async (ctx) => {
    if (!admins.some(admin => admin === ctx.from.id)) {
        return
    }

    if (isRunning) {
        ctx.reply('Bot is already running ! ')
    } else {
        ctx.reply("The bot has been successfully started 🟢")
        isRunning = true

        await sleep(1000);

        console.log("program başladı")

        updatePriceDataInterval = setInterval(updatePriceData, 5 * 60 * 1000);
        allChainFetchInterval = setInterval(allChainFetchLoop, 2 * 60 * 60 * 1000);
        dayInterval = setInterval(fetchChainData, 12 * 60 * 60 * 1000)

        console.log("Periyodik işlem başlatıldı.");
    }

});




bot.command('stop_bot', (ctx) => {
    if (!admins.some(admin => admin === ctx.from.id)) {
        return;
    }

    if (isRunning) {
        // Interval'ları durdur
        clearInterval(updatePriceDataInterval);
        clearInterval(allChainFetchInterval);
        clearInterval(dayInterval);


        isRunning = false;

        console.log("Periyodik işlem durduruldu.");
        ctx.reply("The bot has been successfully stopped 🔴");

    } else {
        ctx.reply("Bot is not running !");
    }
});


//#endregion --- start stop ---







//#region --- loop ---


function updatePriceDataLoop(existingPrices, newPrices) {

    existingPrices.shift();

    console.log('# update #')

    function filterPrices(newPrices, existingPrices) {
        const limit = newPrices.length;
        let startIndex = -1;

        for (let i = 0; i < newPrices.length; i++) {
            for (let j = 0; j < limit && j < existingPrices.length; j++) {
                if (newPrices[i] === existingPrices[j]) {
                    startIndex = i;
                    while (i < newPrices.length && j < existingPrices.length && newPrices[i] === existingPrices[j]) {
                        i++;
                        j++;
                    }
                    if (i < newPrices.length && j < existingPrices.length) {
                        return newPrices.slice(0, startIndex);
                    }
                }
            }
            if (startIndex !== -1) {
                break;
            }
        }
        return newPrices;
    }


    const filteredNewPrices = filterPrices(newPrices, existingPrices);

    existingPrices.unshift(...filteredNewPrices);

    const maxSize = 100;
    if (existingPrices.length > maxSize) {
        existingPrices.splice(maxSize, existingPrices.length - maxSize);
    }

    return existingPrices;
}



function allChainFetchLoop() {

    console.log("loopa girdik kaptan")

    for (let index = 0; index < blockChains.length; index++) {
        const element = blockChains[index];

        const coinDataPath = `src/data/blockChain/${element}.json`;
        const coins = JSON.parse(fs.readFileSync(coinDataPath, 'utf8'));
        fetchDataAndProcessLoop(coins, coinDataPath);
    }
}

async function fetchDataAndProcessLoop(coins, coinDataPath) {

    for (const coin of coins) {
        const config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: `https://openapiv1.coinstats.app/coins/${coin.id}/charts?period=24h`,
            headers: {
                'X-API-KEY': coinStatsOpenApiKeyG
            }
        };

        let response


        try {
            response = await axios.request(config);
        } catch (error) {
            console.log(error);
        }


        try {
            const exactHours = [0, 4, 8, 12, 16, 20];
            const result = getFilteredRecordsLoop(response.data, exactHours);

            if (coin['h4']) {
                coin['h4'] = updatePriceDataLoop(coin['h4'], result.prices);
            } else {
                coin['h4'] = result.prices;
            }



        } catch (error) {
            console.log(error);
        }

        try {
            const exactHours = [0, 8, 16];
            const result = getFilteredRecordsLoop(response.data, exactHours);

            if (coin['h8']) {
                coin['h8'] = updatePriceDataLoop(coin['h8'], result.prices);
            } else {
                coin['h8'] = result.prices;
            }



        } catch (error) {
            console.log(error);
        }



        try {
            const exactHours = [0];
            const result = getFilteredRecordsLoop(response.data, exactHours);

            if (coin['h24']) {
                coin['h24'] = updatePriceDataLoop(coin['h24'], result.prices);
            } else {
                coin['h24'] = result.prices;
            }


        } catch (error) {
            console.log(error);
        }


    }
    fs.writeFileSync(coinDataPath, JSON.stringify(coins, null, 2));
}

const getFilteredRecordsLoop = (data, exactHours) => {

    const filteredData = [];
    let lastDate = null;

    if (data.length > 0) {
        const lastRecord = data[data.length - 1];
        filteredData.push(lastRecord[1]);
    }

    let oneTimeDate = 0;

    for (let i = data.length - 2; i >= 0 && filteredData.length < 15; i--) {
        const timestamp = data[i][0];
        const date = new Date(timestamp * 1000);
        const hour = date.getHours();
        const minutes = date.getMinutes();
        if (exactHours.includes(hour) && minutes === 0) {
            filteredData.push(data[i][1]);

            if (oneTimeDate == 0) {
                lastDate = new Date(timestamp * 1000);
                oneTimeDate++
            }

        }
    }



    return {
        prices: filteredData,
        lastDate: lastDate
    };
};


//#endregion







//#region -1-


async function first() {
    if (!isRunning) {
        return;
    }
    fetchChainData()

    await sleep(7000)

    allChainFetch();
}



function allChainFetch() {
    if (!isRunning) {
        return;
    }
    console.log("allChainFetch çalıştı tümü tek tek çekiliyor")

    for (let index = 0; index < blockChains.length; index++) {
        const element = blockChains[index];

        const coinDataPath = `src/data/blockChain/${element}.json`;
        const coins = JSON.parse(fs.readFileSync(coinDataPath, 'utf8'));
        console.log(element)
        fetchDataAndProcess(coins, coinDataPath);
    }
}

async function fetchDataAndProcess(coins, coinDataPath) {
    if (!isRunning) {
        return;
    }
    for (const coin of coins) {
        if (!isRunning) {
            return;
        }
        const config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: `https://openapiv1.coinstats.app/coins/${coin.id}/charts?period=1w`,
            headers: {
                'X-API-KEY': coinStatsOpenApiKeyG
            }
        };

        try {
            const response = await axios.request(config);
            const exactHours = [2, 6, 10, 14, 18, 22];
            const result = getFilteredRecords(response.data, exactHours);
            coin['h4'] = result.prices;
            // coin['lastDate4h'] = result.lastDate; 
            // console.log(result.prices);

        } catch (error) {
            console.log(error);
        }

        try {
            const response = await axios.request(config);
            const exactHours = [6, 14, 22];
            const result = getFilteredRecords(response.data, exactHours);
            coin['h8'] = result.prices;
            // coin['lastDate8h'] = result.lastDate; 
            // console.log(result.prices);

        } catch (error) {
            console.log(error);
        }


        const config2 = {
            method: 'get',
            maxBodyLength: Infinity,
            url: `https://openapiv1.coinstats.app/coins/${coin.id}/charts?period=1m`,
            headers: {
                'X-API-KEY': coinStatsOpenApiKeyG
            }
        };


        try {
            const response = await axios.request(config2);
            const result = asd(response.data);
            coin['h24'] = result.prices;
            // coin['lastDate8h'] = result.lastDate; 
            // console.log(result.prices);

        } catch (error) {
            console.log(error);
        }


    }

    fs.writeFileSync(coinDataPath, JSON.stringify(coins, null, 2));
}

function asd(data) {
    if (!isRunning) {
        return;
    }

    const filteredData = [];
    let lastDate = null;

    if (data.length > 0) {
        const lastRecord = data[data.length - 1];
        filteredData.push(lastRecord[1]);
        console.log(filteredData)
    }

    let oneTimeDate = 0;

    for (let i = data.length - 2; i >= 0 && filteredData.length < 44; i--) {
        const timestamp = data[i][0];
        const date = new Date(timestamp * 1000);
        const hour = date.getHours();
        const minutes = date.getMinutes();

        filteredData.push(data[i][1]);

    }

    return {
        prices: filteredData,
        lastDate: lastDate
    };
}


const getFilteredRecords = (data, exactHours) => {
    if (!isRunning) {
        return;
    }

    const filteredData = [];
    let lastDate = null;

    if (data.length > 0) {
        const lastRecord = data[data.length - 1];
        filteredData.push(lastRecord[1]);
    }

    let oneTimeDate = 0;

    for (let i = data.length - 2; i >= 0 && filteredData.length < 44; i--) {
        const timestamp = data[i][0];
        const date = new Date(timestamp * 1000);
        const hour = date.getHours();
        const minutes = date.getMinutes();
        if (exactHours.includes(hour)) {
            filteredData.push(data[i][1]);

            console.log(date)

            if (oneTimeDate == 0) {
                lastDate = new Date(timestamp * 1000);
                oneTimeDate++
            }

        }
    }
    console.log(filteredData)


    return {
        prices: filteredData,
        lastDate: lastDate
    };
};



//#endregion ---







//#region --- chain ---



function fetchChainData() {
    blockChains.forEach(chainName => {
        let config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: `https://openapiv1.coinstats.app/coins?limit=1000&currency=USD&blockchain=${chainName}`,
            headers: {
                'X-API-KEY': coinStatsOpenApiKeyG,
                'accept': 'application/json'
            }
        };

        axios.request(config)
            .then((response) => {
                const newData = response.data.result
                    .map(coin => ({
                        id: coin.id,
                        name: coin.name,
                        symbol: coin.symbol,
                        rank: coin.rank,
                        websiteUrl: coin.websiteUrl || null,
                        icon: coin.icon,
                        volume: coin.volume,
                        marketCap: coin.marketCap,
                        priceChange1h: coin.priceChange1h,
                        priceChange1d: coin.priceChange1d,
                        priceChange1w: coin.priceChange1w,
                    }));

                const filePath = `src/data/blockChain/${chainName}.json`;
                fs.readFile(filePath, 'utf8', (err, data) => {
                    if (err && err.code === 'ENOENT') {
                        // Dosya yoksa, yeni dosya oluştur
                        fs.writeFile(filePath, JSON.stringify(newData, null, 4), 'utf8', err => {
                            if (err) {
                                console.error('Error writing file:', err);
                            } else {
                                console.log(`${chainName}.json file has been saved.`);
                            }
                        });
                    } else if (!err) {
                        // Dosyadaki verileri güncelle
                        let existingData = JSON.parse(data);
                        const updatedData = existingData.map(coin => {
                            let newCoinData = newData.find(c => c.id === coin.id);
                            return newCoinData ? { ...coin, 
                                icon: newCoinData.icon,
                                volume: newCoinData.volume,
                                marketCap: newCoinData.marketCap,
                                priceChange1h: newCoinData.priceChange1h,
                                priceChange1d: newCoinData.priceChange1d,
                                priceChange1w: newCoinData.priceChange1w
                            } : coin;
                        });

                        fs.writeFile(filePath, JSON.stringify(updatedData, null, 4), 'utf8', err => {
                            if (err) {
                                console.error('Error writing file:', err);
                            } else {
                                console.log(`${chainName}.json file has been updated.`);
                            }
                        });
                    } else {
                        console.error('Error reading file:', err);
                    }
                });
            })
            .catch((error) => {
                console.error(`Error fetching data for ${chainName}:`, error);
            });
    });
}






async function updatePriceData() {
    if (!isRunning) {
        return;
    }
    for (const chainName of blockChains) {
        if (!isRunning) {
            return;
        }
        const coinDataPath = `src/data/blockChain/${chainName}.json`;
        const coins = JSON.parse(fs.readFileSync(coinDataPath, 'utf8'));

        let config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: `https://openapiv1.coinstats.app/coins?limit=1000&currency=USD&blockchain=${chainName}`,
            headers: {
                'X-API-KEY': coinStatsOpenApiKeyG,
                'accept': 'application/json'
            }
        };

        const response = await axios.request(config);
        const updatedData = response.data.result;

        for (const coin of coins) {
            const matchedCoin = updatedData.find(c => c.id === coin.id);
            if (matchedCoin) {
                if (coin.h4) {
                    coin.h4[0] = matchedCoin.price;
                }
                if (coin.h8) {
                    coin.h8[0] = matchedCoin.price;
                }
                if (coin.h24) {
                    coin.h24[0] = matchedCoin.price;
                }
            }
        }

        fs.writeFileSync(coinDataPath, JSON.stringify(coins, null, 4), 'utf8', (err) => {
            if (err) {
                console.error(`Error writing file for ${chainName}:`, err);
            } else {
                console.log(`${chainName}.json file has been updated.`);
            }
        });
    }
    console.log('geldik')
    calculator();
}



async function calculator() {
    if (!isRunning) {
        return;
    }
    // H24 EKLMEYİ UNUTMA

    for (const element of blockChains) {
        const coinDataPath = `src/data/blockChain/${element}.json`;
        const coins = JSON.parse(fs.readFileSync(coinDataPath, 'utf8'));


        for (const coin of coins) {
            if (!isRunning) {
                return;
            }


            let sendMessageControl = false;
            let h4Rsi = null;
            let h8Rsi = null;
            let h24rsi = null;
            let price = null;
            let priceChange1h = null;
            let priceChange1d = null;
            let priceChange1w = null;

            ['h4', 'h8', 'h24'].forEach(timeFrame => {
                if (coin[timeFrame]) {
                    try {

                        price = coin.h4[0]

                        function calculateRSI(data) {

                            if (data.length < 15) {
                                return
                            }

                            const last14 = data.slice(-14);
                            if (new Set(last14).size === 1) {
                                return -1; 
                            }

                            let gains = 0;
                            let losses = 0;

                            // İlk 14 gün için kazanç ve kayıpları hesapla
                            for (let i = 1; i < 15; i++) {
                                const delta = data[i] - data[i - 1];

                                if (delta > 0) {
                                    gains += delta;
                                } else {
                                    losses -= delta; // losses are positive values
                                }
                            }

                            let averageGain = gains / 14;
                            let averageLoss = losses / 14;
                            let rs = averageGain / averageLoss;
                            let rsi = 100 - 100 / (1 + rs);

                            // 15. günden itibaren RSI'ı güncelle
                            for (let i = 15; i < data.length; i++) {
                                const delta = data[i] - data[i - 1];

                                if (delta > 0) {
                                    averageGain = (averageGain * 13 + delta) / 14;
                                    averageLoss = (averageLoss * 13) / 14;
                                } else {
                                    averageLoss = (averageLoss * 13 - delta) / 14;
                                    averageGain = (averageGain * 13) / 14;
                                }

                                rs = averageGain / averageLoss;
                                rsi = 100 - 100 / (1 + rs);
                            }

                            return rsi;
                        }

                        const reversedData = [...coin[timeFrame]].reverse();

                        let rsi = calculateRSI(reversedData);

                        if (rsi == -1) {
                            return
                        }

                        if (coin.id == 'hivemapper') {
                            return
                        }

                        if (timeFrame == 'h4' && rsi >= 70 ) {
                            console.log(coin.symbol + ": " + rsi)
                        }


                        // return

                        // if (timeFrame == 'h4' && coin.id == 'unclemine') {
                        //     console.log(coin.id + ": " + rsi)
                        // }




                        // const last15 = coin[timeFrame].slice(0, 15)

                        // // Örneğin, 'timeFrame' için veri dizisi varsayılarak
                        // const reversedData1 = [...last15].reverse();

                        // // İlk 15 elemanı al (son 15 eleman çünkü diziyi ters çevirdik)


                        // // Ardışık elemanlar arasındaki farkları hesaplama
                        // const differences = reversedData1.slice(0, -1).map((value, index) => parseFloat(reversedData1[index + 1]) - parseFloat(value));

                        // // Pozitif farklar kazanç, negatif farklar kayıp olarak değerlendirilir
                        // const gains = differences.map(difference => difference > 0 ? difference : 0);
                        // const losses = differences.map(difference => difference < 0 ? -difference : 0);

                        // // Ortalama kazanç ve kayıp hesaplanır
                        // const averageGain = gains.reduce((acc, gain) => acc + gain, 0) / 14;
                        // const averageLoss = losses.reduce((acc, loss) => acc + loss, 0) / 14;

                        // // RS ve RSI hesaplanır
                        // const rs = averageGain / averageLoss;
                        // let rsi1 = 100 - (100 / (1 + rs));


                        // if (timeFrame == 'h4' && coin.id == 'jungle-defi') {
                        //     console.log(coin.symbol + ":: " + rsi1)
                        // }




                        if (timeFrame === 'h4') {
                            rsi = parseFloat(rsi.toFixed(4));
                            if (rsi == null || rsi == -1) {
                                rsi = '--'
                            }
                            if (rsi > 70) {
                                rsi = `${rsi} 🚀`;
                                sendMessageControl = true;
                            }
                            h4Rsi = rsi;

                        }
                        if (timeFrame === 'h8') {
                            rsi = parseFloat(rsi.toFixed(4));
                            if (rsi == null) {
                                rsi = '--'
                            }
                            if (rsi > 70) {
                                rsi = `${rsi} 🚀`;
                                sendMessageControl = true;
                            }
                            h8Rsi = rsi;
                        }
                        if (timeFrame === 'h24') {
                            rsi = parseFloat(rsi.toFixed(4));
                            if (rsi == null) {
                                rsi = '--'
                            }
                            if (rsi > 70) {
                                rsi = `${rsi} 🚀`;
                                sendMessageControl = true;
                            }
                            h24rsi = rsi;
                        }


                        if (rsi > 70) {
                            sendMessageControl = true;
                        }

                    } catch (error) {
                        console.error(`${timeFrame.toUpperCase()} hesaplama hatası:`, error);
                    }
                }
            });


            if (coin.priceChange1h > 0) {
                priceChange1h = `📈 Price Change 1 Hour:  ${coin.priceChange1h} `
            } else {
                priceChange1h = `📉 Price Change 1 Hour:  ${coin.priceChange1h}`
            }


            if (coin.priceChange1d > 0) {
                priceChange1d = `📈 Price Change 1 Day:  ${coin.priceChange1d}`
            } else {
                priceChange1d = `📉 Price Change 1 Day:  ${coin.priceChange1d}`
            }


            if (coin.priceChange1w > 0) {
                priceChange1w = `📈 Price Change 1 Week:  ${coin.priceChange1w}`
            } else {
                priceChange1w = `📉 Price Change 1 Week:  ${coin.priceChange1w}`
            }


            if (sendMessageControl) {
                let message = `
💰  ${coin.symbol}  💰

ID: ${coin.id}

⛓️${element}-BlockChain⛓️

🕓 4 Hours: ${h4Rsi}
🕗 8 Hours: ${h8Rsi}
🕛 24 Hours: ${h24rsi}
                
${priceChange1h}
${priceChange1d}
${priceChange1w}

💲 Price: ${price}
📊 Rank: ${coin.rank}

🌐 Website: ${coin.websiteUrl}
                `
                sendMessageToChannel(savedChannelIdG, message)
                // await sleep(retryAfter * 1000) 
            }

        }
    }
}



//#endregion ---

// isRunning = true;

// // allChainFetchLoop()  

// calculator()

// updatePriceData()

fetchChainData()


bot.launch()