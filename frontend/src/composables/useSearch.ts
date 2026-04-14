import axios from 'axios';
import { 
  backendUrl, searchKeyword, searchSource, searchResults, 
  isSearching, searchPage, searchHasMore 
} from '../store/state';

export function useSearch() {
  const searchMusic = async (loadMore: any = false) => {
    const isLoadMore = typeof loadMore === 'boolean' ? loadMore : false;
    if (!searchKeyword.value.trim()) return;
    if (!isLoadMore) {
      searchPage.value = 1;
      searchResults.value = [];
      searchHasMore.value = true;
    }
    if (!searchHasMore.value) return;

    isSearching.value = true;
    try {
      const resp = await axios.get(`${backendUrl}/api/search`, {
        params: { keyword: searchKeyword.value, source: searchSource.value, page: searchPage.value, limit: 20 }
      });
      if (resp.data.list && resp.data.list.length > 0) {
        searchResults.value = isLoadMore ? [...searchResults.value, ...resp.data.list] : resp.data.list;
        searchPage.value++;
      } else {
        searchHasMore.value = false;
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      isSearching.value = false;
    }
  };

  const handleSearchScroll = (e: Event) => {
    const target = e.target as HTMLElement;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 50) {
      if (!isSearching.value && searchHasMore.value) {
        searchMusic(true);
      }
    }
  };

  return {
    searchMusic,
    handleSearchScroll
  };
}