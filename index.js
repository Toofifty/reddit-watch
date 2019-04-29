import 'dotenv/config'
import nodemailer from 'nodemailer'
import request from 'request'
import fs from 'fs'
import smtp from 'nodemailer-smtp-transport'

const subreddits = process.env.SUBREDDITS.split(',')
const keywords = process.env.KEYWORDS.split(',').map(kw => kw.toLowerCase())

const alerted = []

fs.readFile('./alerted', 'utf8', (err, data) => {
    if (err) {
        fs.writeFile('./alerted', '', err => {
            if (err) console.err
        })
    }
    if (data) data.split(',').forEach(id => alerted.push(id))
})

const createTransport = () => {
    return nodemailer.createTransport(smtp({
        service: 'gmail',
        host: 'smtp.gmail.com',
        auth: {
            user: process.env.SEND_FROM_USER,
            pass: process.env.SEND_FROM_PASS
        }
    }))
}

const mail = {
    from: `reddit-watch <${process.env.SEND_FROM_USER}>`,
    to: process.env.SEND_TO,
    subject: 'no subject set',
    text: 'no text set',
    html: 'no html set'
}

const alert = (post, matches) => {
    console.log(`Alert for ${post.title}`)
    const transport = createTransport()
    const [image = null] = post.preview && post.preview.images || []
    transport.sendMail({
        ...mail,
        subject: `Reddit Watch Alert: ${post.title}`,
        html: `<strong>The following keywords were found</strong>:<br>${matches.join(', ')}<br>
        <strong>Subreddit</strong>:<br>${post.subreddit_name_prefixed}<br>
        <strong>Post title</strong>:<br>${post.title}<br>
        <strong>Post text</strong>:<br>${post.selftext}<br>
        ${image && `<img src="${image.source.url}"/>` || ''}<br>
        <strong>Post URL</strong>:<br>${post.url}<br>`
    }, (err, res) => {
        if (err) {
            console.error(err)
        } else {
            console.log('Sent alert', res)
        }
        transport.close()
    })

    alerted.push(post.id)
    fs.writeFile('./alerted', alerted.join(','), err => {
        if (err) console.err
    })
}

const check = () => {
    subreddits.forEach(subreddit => {
        request({
            url: `https://old.reddit.com/r/${subreddit}/new.json`,
            json: true
        }, (err, _res, body) => {
            if (err) {
                console.error(err)
                return
            }
            const posts = body.data.children
            posts.forEach(({ data: post }) => {
                if (alerted.includes(post.id)) {
                    return true
                }
                const matches = keywords.filter(
                    kw => post.title.toLowerCase().includes(kw)
                        || post.selftext.toLowerCase().includes(kw)
                )
                if (matches.length > 0) {
                    alert(post, matches)
                }
            })
        })
    })
}

check()
// 10 minutes
setInterval(check, 1000 * 60 * 10)