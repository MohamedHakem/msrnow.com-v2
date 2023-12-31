import { NextResponse, NextRequest } from 'next/server';
import * as cheerio from 'cheerio';
import { db } from '@/lib/db';
import { sanitizeTitle } from '@/utils/sanitizeTitle';
import { sanitizeSlug } from '@/utils/sanitizeSlug';
// import { categoriesAndSources } from '@/data/static/staticCategoriesAndSources';
import generateShortSlugs from '@/utils/generateShortSlugs';
import SaveArticles from '@/utils/saveArticles';
import updateLastDate from '@/utils/updateLastDate';
import { articleType, sourceType } from '@/types';
// const util = require('util');

export const runtime = 'nodejs';
export const fetchCache = 'force-no-store';

export async function GET() {
  console.time('[Time] GET Route');

  const category = 'top-headline';

  // const currentCategory = categoriesAndSources.find((c) => c.name === category);
  // if (!currentCategory) {
  //   return new NextResponse('UnSupported Category. If new, add it locally/statically', { status: 415 });
  // }

  // use something like this to get the top_headline: true AND categoryId:1 to get the top_headlines news of a specific category
  // .findUnique({ where: { id: currentCategory.id, AND: { name: 'egypt' } }, select: { last_date: true } })
  // when you want to get all the top headline news, you will need to get all the articles with top_headline true
  // when you want to get all the top headline news of a specific category, you will need to get all the articles with top_headline: true AND categoryId: 1
  // when you want to get all top headline news of the "top-headline" category (not specific for any other category), you will need to get all the articles with: categoryId: 1

  // the logic:
  // scrape top headline news from google news
  // after you've the articles arr BUT before saving to db, check all of them, by slug and published_at date with prisma&db-call,
  // if (any is true) the article doesn't exist, then, add it as a new article with top_headline: true and categoryId: top-headline.id
  // if (false) the article already exists (under a diff category), then, update the top_headline field to true

  const currentCategory = await db.category.findUnique({
    where: { name: category },
    select: { id: true, name: true, google_news_url: true, last_date: true }
  });
  if (!currentCategory) {
    return new NextResponse('UnSupported Category. If new, ADD IT PLEASE', { status: 415 });
  }

  const last_date = currentCategory?.last_date;
  if (!last_date) {
    return new NextResponse('last_date IS EMPTY. If new, ADD IT PLEASE', { status: 415 });
  }

  const page = await fetch(currentCategory.google_news_url).then((res) => res.text());
  const $ = cheerio.load(page, { xmlMode: true });

  // const sources = currentCategory.source; // re-think and uncomment when you start to filter-out some blocked-sources (add as new field/column)
  const scrapedFromSource = 'https://news.google.com/';
  let newLastDate = new Date(last_date);
  console.log('[Before] last_date: ', last_date);

  let coverage_url = '';
  let coverage_url_arr: string[] = [];
  let currentSources: { name: string }[] = [];
  let updatedSourcesFromDB: sourceType[] = [];

  const updateCurrentSources = (allSources: sourceType[]) => {
    console.log('[updateCurrentSources] allSources: ', allSources.length);
    updatedSourcesFromDB = allSources;
    console.log(
      '[updateCurrentSources] updatedSourcesFromDB: ',
      updatedSourcesFromDB[0],
      ' - ',
      updatedSourcesFromDB.length
    );
  };

  const getSourceId = (sourceName: string) => {
    const source = updatedSourcesFromDB.filter((s) => s.name === sourceName);
    return source[0]?.id || sourceName;
  };

  const getSourceIdByName = (sourceName: string) => {
    const source = updatedSourcesFromDB.filter((s) => s.name.trim() === sourceName);
    return source[0]?.id;
  };

  const articles = await Promise.all(
    $('article.IBr9hb, article.IFHyqb.DeXSAc')
      .filter((_, article) => {
        const hasImage = $(article).find('img.Quavad').length > 0;
        // Delete/Filter-Out specific sources manually when caught manually, for now, accept all sources,
        // const isSupportedSource = sources.some((s) => s.name === $(article).find('.vr1PYe').text().trim());
        const articleDatetime = $(article).find('time.hvbAAd').attr('datetime');
        if (articleDatetime && last_date) {
          const isRecent = new Date(articleDatetime) > new Date(last_date);
          const isNewLastDate = newLastDate ? new Date(articleDatetime) > newLastDate : false;
          if (isNewLastDate) {
            newLastDate = new Date(articleDatetime);
          }
          if (hasImage && isRecent && article.next) {
            coverage_url = $(article.next).children('.Ylktk').children('.jKHa4e').attr('href')?.toString() || '';
            coverage_url_arr.push(coverage_url);

            const articleSource = $(article).find('.vr1PYe').text().trim();
            currentSources.push({ name: articleSource });
          }
          return hasImage && isRecent;
        }
        return false;
      })
      .map(async (i, article) => {
        let allSources: sourceType[] = [];
        if (i === 0) {
          console.log('[i===0] currentSources[0]: ', currentSources[0], ' - ', currentSources.length);
          const currentSourceRes = await db.source.createMany({
            data: currentSources,
            skipDuplicates: true
          });
          console.log('[i===0] currentSourceRes: ', currentSourceRes);
          // if there was any new sources that prisma just saved to the db, then fetch all (updated) sources
          // get allSources from db, since I don't have them anyway, whether prisma just added new sources to them or not
          allSources = await db.source.findMany();
          console.log('[i===0] allSources.length: ', allSources.length);
          updateCurrentSources(allSources);
        }

        const articleObj = {
          scraped_from: scrapedFromSource,
          title: sanitizeTitle($(article).find('h4').text().trim()),
          google_thumb: $(article).find('img.Quavad').attr('src'),
          article_google_url: `${scrapedFromSource}${$(article).find('a').attr('href')}`,
          related_coverage_url: coverage_url_arr[i] ? `${scrapedFromSource}${coverage_url_arr[i]}` : '',
          slug: sanitizeSlug($(article).find('h4').text().trim()),
          published_at: $(article).find('time.hvbAAd').attr('datetime'),
          // sourceId: sources.filter((s) => s.name === $(article).find('.vr1PYe').text().trim())[0].id,
          sourceId: getSourceId($(article).find('.vr1PYe').text().trim()),
          categoryId: currentCategory.id,
          short_slug: generateShortSlugs(1)[0],
          top_headline: true
        };
        return articleObj;
      })
      .get()
  );

  console.log('[After] newLastDate: ', newLastDate);
  console.log('coverage_url_arr[0] and length: ', coverage_url_arr[0], ' - ', coverage_url_arr.length);

  // articles.map((a) => console.log('a.sourceId: ', a.sourceId)); // check if all have sourceId and not sourceName

  let currentSlugs: string[] = [];
  const articlesWithSourceid = articles.map((a: articleType, i) => {
    const sourceId = typeof a.sourceId === 'string' ? getSourceIdByName(a.sourceId) : a.sourceId;
    currentSlugs.push(a.slug);
    return { ...a, sourceId: sourceId };
  });

  // articlesWithSourceid.map((a) => console.log('a.sourceId: ', a.sourceId)); // check if all have sourceId and not sourceName
  console.log('articlesWithSourceid: ', articlesWithSourceid[0], ' - ', articlesWithSourceid.length);

  // call with prisma, are there any article with any of these slugs or any of these published_at dates?
  console.log('currentSlugs.length: ', currentSlugs.length);
  const areThereDuplicates = await db.article.findMany({
    where: {
      slug: {
        in: currentSlugs
      }
    }
  });
  // if yes, return them to me, then loop over them and update their top_headline field to true // ignore the following, it already exist with it's correct categoryId // and their categoryId field to that category id
  console.log('areThereDuplicates: ', areThereDuplicates[0], ' - ', areThereDuplicates.length);
  if (areThereDuplicates.length > 0) {
    console.log('updatedArticles START');
    const updatedArticles = await db.article.updateMany({
      data: { top_headline: true },
      where: {
        slug: {
          in: currentSlugs
        }
      }
    });
    console.log('[prisma] updatedArticles: ', updatedArticles);
    console.log('updatedArticles DONE');
  }
  // if no, or all the rest if some was yes, loop and save to the db as new articles with top_headline field true and categoryId: top-headline.id
  console.log('savedArticles START');
  const savedArticles = await db.article.createMany({
    data: articlesWithSourceid,
    skipDuplicates: true
  });
  console.log('[prisma] savedArticles: ', savedArticles);
  console.log('savedArticles DONE');

  // check that there are new articles, and newLastDate has the updated last_date
  if (newLastDate > new Date(last_date)) {
    console.log('lastDate: ', new Date(last_date));
    console.log('newLastDate: ', newLastDate);
    console.log('Updating last_date to DB...');
    const updatedLastDateRes = await updateLastDate({ newLastDate, currentCategory });
    if (updatedLastDateRes && updatedLastDateRes.last_date) {
      console.log('Updated last_date on db, updatedLastDateRes: ', updatedLastDateRes.last_date);
    }
  }

  console.timeEnd('[Time] GET Route');
  return NextResponse.json({
    status: 200,
    last_date: last_date,
    newLastDate: newLastDate,
    articles: articlesWithSourceid,
    areThereDuplicates: areThereDuplicates,
    savedArticles: savedArticles
  });
}
