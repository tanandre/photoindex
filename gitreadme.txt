git init

# Adds the files in the local repository and stages them for commit. To unstage a file, use 'git reset HEAD YOUR-FILE'.
git add .

# Commits the tracked changes and prepares them to be pushed to a remote repository. To remove this commit and modify the file, use 'git reset --soft HEAD~1' and commit and add the file again.
git commit -m "First commit"

# Sets the new remote
git remote add origin https://github.com/tanandre/photoindex
git remote add origin https://github.com/tanandre/soccerkings

# Verifies the new remote URL
git remote -v

# Pushes the changes in your local repository up to the remote repository you specified as the origin
git push origin master

# pulls the current version
git pull origin master




### hard reset ###
git fetch --all
git reset --hard origin/master


git push -u origin feature/AT-58-support-xcpd-transactions

git clone ssh://admin@kanji/volume1/git/soccerkings