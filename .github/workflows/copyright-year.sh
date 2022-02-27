#!/usr/bin/env bash
dir=${1:-$PWD}
dates=($(git log --date=format:%Y --pretty=format:'%ad' --reverse | sort | uniq))
if [ "${#dates[@]}" -eq 1 ]; then
  datestr="${dates}"
else
  datestr="${dates}-${dates[${#dates[@]}-1]}"
fi

stripDate='s/^((.*)Copyright\b(.*?))((?:,\s*)?(([0-9]{4}\s*-\s*[0-9]{4})|(([0-9]{4},\s*)*[0-9]{4})))(?:,)?\s*(.*)\n$/$1$9\n/g'
addDate='s/^.*Copyright(?:\s*\(c\))? /Copyright \(c\) '$datestr' /g'
for l in $dir/LICENSE*; do
  perl -pi -e "$stripDate" $l
  perl -pi -e "$addDate" $l
done
