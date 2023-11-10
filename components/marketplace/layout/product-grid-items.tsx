import Grid from '@/components/marketplace/grid';
import { GridTileImage } from '@/components/marketplace/grid/tile';
// import { Product } from '@/lib/marketplace/types';
import Link from 'next/link';

export default function ProductGridItems({ products }: { products: any[] }) {
  return (
    <>
      {products.map((product, i) => (
        <Grid.Item key={product.id} className="animate-fadeIn">
          <Link className="relative inline-block h-full w-full" href={`/marketplace/product/${product.slug}`}>
            <GridTileImage
              alt={product.title}
              label={{
                title: product.title,
                amount: product.price,
                currencyCode: "EGP"
              }}
              src={`https://imagecdn.app/v2/image/${product.images[0]?.url}?width=490&height=490`}
              fill
              priority={i < 3 ? true : false}
              sizes="(min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
            />
          </Link>
        </Grid.Item>
      ))}
    </>
  );
}
