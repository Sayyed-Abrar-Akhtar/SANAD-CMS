import { NextRequest, NextResponse } from 'next/server';

const JULES_API_URL = 'https://jules.googleapis.com/v1alpha';

export async function GET(req: NextRequest) {
  try {
    const julesApiKey = process.env.JULES_API_KEY || 'mock-jules-api-key';

    // Simulation mode during tests / mock key
    if (process.env.NODE_ENV === 'test' || julesApiKey === 'mock-jules-api-key') {
      return NextResponse.json({
        sources: [
          {
            name: 'sources/github-acmeco-storefront',
            displayName: 'acmeco/storefront',
            githubRepo: 'acmeco/storefront',
            createTime: '2024-01-01T00:00:00Z',
          },
          {
            name: 'sources/github-acmeco-blog',
            displayName: 'acmeco/blog',
            githubRepo: 'acmeco/blog',
            createTime: '2024-01-01T00:00:00Z',
          },
          {
            name: 'sources/github-acmeco-docs',
            displayName: 'acmeco/docs',
            githubRepo: 'acmeco/docs',
            createTime: '2024-01-01T00:00:00Z',
          },
        ],
      });
    }

    const res = await fetch(`${JULES_API_URL}/sources`, {
      headers: {
        'x-goog-api-key': julesApiKey,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json(
        { error: `Jules API list sources failed (${res.status}): ${errorText}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}