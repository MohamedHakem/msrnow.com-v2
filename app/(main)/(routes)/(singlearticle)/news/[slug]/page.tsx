// import ViewCounter from '@/components/view-counter';
import getArticle from '@/data/getArticle';
// import MostViewedArticles from '@/components/most-viewed-articles';
// import IncrementViewCounter from '@/components/increment-view-counter';
// import Image from 'next/image';
// import SingleArticle from '@/components/articlepage/single-article';
// import ScrapeArticleContent from '@/utils/scrapeArticleContent';
// import { Await } from '@/components/await';
import { Suspense } from 'react';
import SingleArticleSkeleton from '@/components/skeletons/single-article-skeleton';
import RelatedTimeline from '@/components/articlepage/related-timeline';
// import ArticleRendererSSR from '@/components/article-renderer-ssr';
import ArticleSettingSidebar from '@/components/articlepage/article-settings-sidebar';
import ArticleHeader from '@/components/articlepage/article-header';
import IncrementViewCounter from '@/components/increment-view-counter';
import ArticleBody from '@/components/articlepage/article-body';
// import RelatedTimeline from '@/components/articlepage/related-timeline';

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  console.log('[ArticlePage] slug:', decodeURIComponent(slug));

  let article = await getArticle(decodeURIComponent(params.slug));
  if (article === null) {
    console.log('[ArticlePage] article === null is true');
    return <SingleArticleSkeleton />;
  }

  // imitate delay
  // await new Promise((resolve) => setTimeout(resolve, 50000));

  return (
    <div className="flex flex-col desktop:flex-row rounded-md gap-4 py-10 px-4 container:px-0 scroll-m-0">
      {console.time('Article Page') as React.ReactNode}
      <div
        dir="rtl"
        className="flex flex-col flex-auto laptop:flex-row w-full items-center transition-all duration-200 ease-in-out"
      >
        <IncrementViewCounter slug={article.slug} />
        <div className="flex flex-col laptop:flex-row justify-between flex-auto">
          <div className="flex flex-col laptop:w-2/3 desktop:flex-auto max-w-[650px] gap-4">
            <ArticleHeader article={article} />
            <ArticleSettingSidebar />
            <div className="flex flex-col gap-2 w-full h-auto rounded-md py-4 mx-auto">
              <Suspense
                fallback={
                  <div className="w-full h-[500px] p-4 mx-auto bg-gray-200 animate-pulse border flex flex-row justify-center items-center text-2xl text-gray-800">
                    جاري التحقق من الخبر
                  </div>
                }
              >
                <ArticleBody article={article} />
              </Suspense>
            </div>
          </div>
          <div className="flex flex-col w-[calc(100dvh - 34px)] laptop:w-1/3">
            {/* {console.time('RelatedTimeline') as React.ReactNode} */}
            <Suspense fallback={<div className="w-full h-screen p-4 mx-auto bg-gray-200 animate-pulse"></div>}>
              <RelatedTimeline
                related_coverage_url={article.related_coverage_url}
                related_coverage_article={article.related_coverage_article}
                related_coverage_tweets={article.related_coverage_tweets}
                short_slug={article.short_slug}
                categoryId={article.categoryId}
              />
            </Suspense>
            {/* <div className="w-full h-52 border bg-gray-300 animate-pulse"></div> */}
            {/* {console.timeEnd('RelatedTimeline') as React.ReactNode} */}
          </div>
        </div>
      </div>
      {console.timeEnd('Article Page') as React.ReactNode}
    </div>
  );
}